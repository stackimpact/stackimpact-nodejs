'use strict';

const os = require('os');
const fs = require('fs');
const util = require('util');
const Metric = require('../metric').Metric;
const Breakdown = require('../metric').Breakdown;



class AsyncProfiler {
  
  constructor(agent) {
    let self = this;

    self.EXCLUDE_SAMPLE_TYPES = {
      'TIMERWRAP': true,
      'Timeout': true,
      'Immediate': true,
      'TickObject': true,
      'PROMISE': true
    };
    self.MAX_FRAMES = 50;
    self.SAMPLE_LIMIT = 500;

    self.agent = agent;
    self.asyncProfile = undefined;
    self.asyncTrace = undefined;
    self.profileDuration = undefined;
    self.spanStart = undefined;
    self.asyncHook = undefined;
    self.samples = undefined;
    self.sampleLimitReached = false;
  }


  test() {
    let self = this;

    if (self.agent.getOption('asyncProfilerDisabled')) {
      return false;
    }

    if (!self.agent.matchVersion("v8.1.0", null)) {
      self.agent.log('Async profiler is supported starting Node.js v8.1.0');
      return false;
    }

    return true;
  }


  initSampler() {
    let self = this;

    self.samples = new Map();

    // cannot use console.log based logging
    function error(err) {
      if (self.agent.getOption('debug')) {
        fs.writeSync(2, `${self.agent.logPrefix()} ${util.format(err)}\n`);
      }
    }

    function generateStackTrace(skip) {
      var orig = Error.prepareStackTrace;
      Error.prepareStackTrace = function(error, structuredStackTrace) {
        return structuredStackTrace;
      };

      var stack = new Error().stack;

      Error.prepareStackTrace = orig;

      if (stack) {
        return stack.slice(skip);
      }
      else {
        return null;
      }
    }


    function init(asyncId, type, triggerAsyncId, resource) {
      try {
        if (self.sampleLimitReached) {
          return;
        }

        if (self.samples.size >= self.SAMPLE_LIMIT) {
          self.sampleLimitReached = true;
          return;
        }

        self.samples.set(asyncId, {
          asyncId: asyncId,
          triggerAsyncId: triggerAsyncId,
          type: type,
          start: self.hrmillis(),
          stack: generateStackTrace(3),
          time: null
        });
      }
      catch(err) {
        error(err);
      }
    }


    function before(asyncId) {
      try {
        let sample = self.samples.get(asyncId);
        if (!sample) {
          return;
        }

        sample.time = self.hrmillis() - sample.start;
      }
      catch(err) {
        error(err);
      }
    }

    const asyncHooks = require('async_hooks');
    self.asyncHook = asyncHooks.createHook({ init, before });
  }


  reset() {
    let self = this;

    if (!self.asyncHook) {
      self.initSampler();
    }

    self.asyncProfile = new Breakdown(self.agent, 'Async call graph', Breakdown.c.TYPE_CALLGRAPH);
    self.asyncTrace = new Breakdown(self.agent, 'Async call graph', Breakdown.c.TYPE_CALLGRAPH);
    self.profileDuration = 0;
  }


  startProfiler() {
    let self = this;

    self.sampleLimitReached = false;
    self.samples.clear();
    self.asyncHook.enable();
    self.spanStart = self.hrmillis();
  }


  stopProfiler() {
    let self = this;

    self.asyncHook.disable();

    // calculate actual record duration
    if (!self.sampleLimitReached) {
      self.profileDuration += self.hrmillis() - self.spanStart;
    }
    else {
      let spanEnd = self.spanStart;
      for(let sample of self.samples.values()) {
        if (sample.time) {
          let sampleEnd = sample.start + sample.time;
          if (sampleEnd > spanEnd) {
            spanEnd = sampleEnd;
          }
        }
      }

      if (spanEnd <= self.spanStart) {
        spanEnd = self.hrmillis();
      }

      self.profileDuration += spanEnd - self.spanStart;
    }

    self.updateProfile();

    self.samples.clear();    
  }


  updateProfile() {
    let self = this;

    let includeAgentFrames = self.agent.getOption('includeAgentFrames');

    for(let sample of self.samples.values()) {
      if (!sample.time) {
        continue;
      }

      if (self.EXCLUDE_SAMPLE_TYPES[sample.type]) {
        continue;
      }

      let frames = self.createStackTrace(sample, includeAgentFrames);
      if (frames.length === 0) {
        continue;
      }
      frames = frames.reverse();


      // update profile
      let node = self.asyncProfile;
      for (let frame of frames) {
        node = node.findOrAddChild(frame);
        node.setType(Breakdown.c.TYPE_CALLSITE);
      }
      if (sample.type) {
        node.addMetadata('Resource', sample.type);
      }

      node.measurement += sample.time;
      node.numSamples += 1;

      // update trace
      node = self.asyncTrace;
      for (let frame of frames) {
        node = node.findOrAddChild(frame);
        node.setType(Breakdown.c.TYPE_CALLSITE);
      }
      if (sample.type) {
        node.addMetadata('Resource', sample.type);
      }

      node.updateP95(sample.time);
    }
  }


  createStackTrace(sample, includeAgentFrames) {
    let self = this;

    let frames = new Set();
    let processed = new Set();

    while (sample && !processed.has(sample.asyncId)) {
      processed.add(sample.asyncId);

      if (sample.stack) {
        self.extractFrames(frames, sample.stack, includeAgentFrames);
        if (frames.size > self.MAX_FRAMES) {
          break;
        }
      }

      sample = self.samples.get(sample.triggerAsyncId);
    }

    return Array.from(frames);
  }


  extractFrames(frames, stack, includeAgentFrames) {
    let self = this;

    if (!includeAgentFrames) {
      let agentStack = false;
      stack.forEach((callSite) => {
        if (self.agent.AGENT_FRAME_REGEXP.exec(callSite.getFileName())) {
          agentStack = true;
        }
      });
      if(agentStack) {
        return;
      }
    }

    stack.forEach((callSite) => {
      let frame = '';
      if (callSite.getFunctionName()) {
        frame = callSite.getFunctionName();
      }
      if (callSite.getMethodName()) {
        frame += ` [as ${callSite.getMethodName()}]`;
      }
      if (callSite.getFileName()) {
        frame += ` (${callSite.getFileName()}:${callSite.getLineNumber()}:${callSite.getColumnNumber()})`;
      }

      if (frame && !frames.has(frame)) {
        frames.add(frame);
      }
    });
  }


  buildProfile(duration) {
    let self = this;

    self.asyncProfile.propagate();
    self.asyncProfile.normalize(self.profileDuration / 1000);
    self.asyncProfile.round();
    self.asyncProfile.filter(2, 1, Infinity);

    self.asyncTrace.evaluateP95();
    self.asyncTrace.propagate();
    self.asyncTrace.round();
    self.asyncTrace.filter(2, 1, Infinity);

    return [
      {
        category: Metric.c.CATEGORY_ASYNC_PROFILE,
        name: Metric.c.NAME_ASYNC_CALL_TIMES,
        unit: Metric.c.UNIT_MILLISECOND,
        unitInterval: 1,
        profile: self.asyncProfile
      },
      {
        category: Metric.c.CATEGORY_ASYNC_TRACE,
        name: Metric.c.NAME_ASYNC_CALL_TIMES,
        unit: Metric.c.UNIT_MILLISECOND,
        profile: self.asyncTrace
      }
    ];
  }


  hrmillis() {
    const t = process.hrtime();
    return t[0] * 1e3 + t[1] / 1e6;
  }

}

exports.AsyncProfiler = AsyncProfiler;
