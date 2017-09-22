'use strict';

const os = require('os');
const fs = require('fs');
const util = require('util');
const ProfilerScheduler = require('../profiler_scheduler').ProfilerScheduler;
const Metric = require('../metric').Metric;
const Breakdown = require('../metric').Breakdown;




class AsyncReporter {
  
  constructor(agent) {
    let self = this;

    self.agentFrameRegexp = /node_modules\/stackimpact\//;

    self.agent = agent;
    self.profileScheduler = undefined;
    self.asyncProfile = undefined;
    self.asyncTrace = undefined;
    self.recordDuration = 0;
    self.stopTimer = undefined;


    self.asyncHook = undefined;
    self.samples = undefined;
    self.sampleLimit = 500;
    self.sampleLimitReached = false;
    self.excludeSampleTypes = {
      'TIMERWRAP': true,
      'Timeout': true,
      'Immediate': true,
      'TickObject': true,
      'PROMISE': true
    };

    self.maxFrames = 50;
  }


  start() {
    let self = this;

    if (self.agent.getOption('asyncProfilerDisabled')) {
      return;
    }

    if (!self.agent.minVersion(8, 1, 0)) {
      self.agent.log('Async profiler is supported since Node.js v8.1.0');
      return;
    }

    self.initSampler();

    self.resetProfile();

    self.profilerScheduler = new ProfilerScheduler(
        self.agent, 
        20 * 1000, 4 * 1000, 120 * 1000,
        (duration, callback) => { self.record(duration, callback); },
        (callback) => { self.report(callback); });
    self.profilerScheduler.start();
  }


  destroy() {
    let self = this;

    if (self.agent.getOption('asyncProfilerDisabled')) {
      return;
    }

    if (self.profileScheduler) {
      self.profileScheduler.destroy();
      self.profileScheduler = undefined;
    }

    if (self.stopTimer) {
      clearTimeout(self.stopTimer);
      self.stopTimer = undefined;
      self.asyncHook.disable();
    }
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

        if (self.samples.size >= self.sampleLimit) {
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


  resetProfile() {
    let self = this;

    self.asyncProfile = new Breakdown(self.agent, 'root');
    self.asyncTrace = new Breakdown(self.agent, 'root');
    self.recordDuration = 0;
  }


  record(duration, callback) {
    let self = this;

    self.sampleLimitReached = false;
    self.samples.clear();
    self.asyncHook.enable();

    let includeAgentFrames = self.agent.getOption('includeAgentFrames');

    let recordStart = self.hrmillis();

    self.stopTimer = self.agent.setTimeout(() => {
      try {
        self.stopTimer = null;

        self.asyncHook.disable();

        // calculate actual record duration
        if (!self.sampleLimitReached) {
          self.recordDuration += self.hrmillis() - recordStart;
        }
        else {
          let recordEnd = recordStart;
          for(let sample of self.samples.values()) {
            if (sample.time) {
              let sampleEnd = sample.start + sample.time;
              if (sampleEnd > recordEnd) {
                recordEnd = sampleEnd;
              }
            }
          }

          if (recordEnd <= recordStart) {
            recordEnd = self.hrmillis();
          }

          self.recordDuration += recordEnd - recordStart;
        }

        // update profiles
        for(let sample of self.samples.values()) {
          if (!sample.time) {
            continue;
          }

          if (self.excludeSampleTypes[sample.type]) {
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
          }

          node.measurement += sample.time;
          node.numSamples += 1;

          // update trace
          node = self.asyncTrace;
          for (let frame of frames) {
            node = node.findOrAddChild(frame);
          }

          node.updateP95(sample.time);
        }

        self.samples.clear();
      }
      catch(err) {
        self.agent.exception(err);
      }

      callback();
    }, duration);
  }


  createStackTrace(sample, includeAgentFrames) {
    let self = this;

    let frames = new Set();
    let processed = new Set();

    while (sample && !processed.has(sample.asyncId)) {
      processed.add(sample.asyncId);

      if (sample.stack) {
        self.extractFrames(frames, sample.stack, includeAgentFrames);
        if (frames.size > self.maxFrames) {
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
        if (self.agentFrameRegexp.exec(callSite.getFileName())) {
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

      if (!frames.has(frame)) {
        frames.add(frame);
      }
    });
  }


  report(callback) {
    let self = this;

    if (self.agent.config.isProfilingDisabled()) {
      callback();
      return;
    }

    if (self.recordDuration === 0) {
      callback();
      return;
    }

    self.asyncProfile.propagate();
    self.asyncProfile.normalize(self.recordDuration / 1000);
    self.asyncProfile.round();
    self.asyncProfile.filter(2, 1, Infinity);

    let metric = new Metric(self.agent, Metric.c.TYPE_PROFILE, Metric.c.CATEGORY_ASYNC_PROFILE, Metric.c.NAME_ASYNC_CALL_TIMES, Metric.c.UNIT_MILLISECOND);
    metric.createMeasurement(Metric.c.TRIGGER_TIMER, self.asyncProfile.measurement, 1, self.asyncProfile);
    self.agent.messageQueue.add('metric', metric.toJson());


    self.asyncTrace.evaluateP95();
    self.asyncTrace.propagate();
    self.asyncTrace.round();
    self.asyncTrace.filter(2, 1, Infinity);

    metric = new Metric(self.agent, Metric.c.TYPE_PROFILE, Metric.c.CATEGORY_ASYNC_TRACE, Metric.c.NAME_ASYNC_CALL_TIMES, Metric.c.UNIT_MILLISECOND);
    metric.createMeasurement(Metric.c.TRIGGER_TIMER, self.asyncTrace.measurement, null, self.asyncTrace);
    self.agent.messageQueue.add('metric', metric.toJson());


    self.resetProfile();

    callback();
  }


  hrmillis() {
    let t = process.hrtime();
    return t[0] * 1e3 + t[1] / 1e6;
  }

}

exports.AsyncReporter = AsyncReporter;
