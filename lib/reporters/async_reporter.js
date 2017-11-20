'use strict';

const os = require('os');
const fs = require('fs');
const util = require('util');
const Metric = require('../metric').Metric;
const Breakdown = require('../metric').Breakdown;



class AsyncReporter {
  
  constructor(agent) {
    let self = this;

    self.MAX_PROFILE_DURATION = 20 * 1000;
    self.MAX_RECORD_DURATION = 4 * 1000;
    self.MAX_RECORD_COUNT = 20;
    self.REPORT_INTERVAL = 120 * 1000;
    self.RECORD_INTERVAL = (self.REPORT_INTERVAL / (self.MAX_PROFILE_DURATION / self.MAX_RECORD_DURATION)) * 0.75;
    self.EXCLUDE_SAMPLE_TYPES = {
      'TIMERWRAP': true,
      'Timeout': true,
      'Immediate': true,
      'TickObject': true,
      'PROMISE': true
    };
    self.MAX_FRAMES = 50;
    self.SAMPLE_LIMIT = 500;
    self.AGENT_FRAME_REGEXP = /node_modules\/stackimpact\//;

    self.agent = agent;
    self.started = false;
    self.recordTimer = undefined;
    self.randomTimer = undefined;
    self.reportTimer = undefined;
    self.asyncProfile = undefined;
    self.asyncTrace = undefined;
    self.profileStartTs = undefined;
    self.profileDuration = undefined;
    self.recordCount = undefined;
    self.asyncHook = undefined;
    self.samples = undefined;
    self.sampleLimitReached = false;
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

    if (!self.asyncHook) {
      self.initSampler();
    }

    if (self.started) {
      return;
    }
    self.started = true;

    self.reset();

    if (self.agent.getOption('autoProfiling')) {
      self.recordTimer = self.agent.setInterval(() => {
        self.randomTimer = self.agent.setTimeout(() => {
          self.record();
        }, Math.round(Math.random() * (self.RECORD_INTERVAL - self.MAX_RECORD_DURATION)));
      }, self.RECORD_INTERVAL);

      self.reportTimer = self.agent.setInterval(() => {
        self.report();
      }, self.REPORT_INTERVAL);
    }
  }


  stop() {
    let self = this;

    if (!self.started) {
      return;
    }
    self.started = false;

    if (self.recordTimer) {
      clearInterval(self.recordTimer);
      self.recordTimer = undefined;
    }

    if (self.randomTimer) {
      clearTimeout(self.randomTimer);
      self.randomTimer = undefined;
    }

    if (self.reportTimer) {
      clearInterval(self.reportTimer);
      self.reportTimer = undefined;
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

    self.asyncProfile = new Breakdown(self.agent, 'root');
    self.asyncTrace = new Breakdown(self.agent, 'root');
    self.profileStartTs = Date.now();
    self.profileDuration = 0;
    self.recordCount = 0;
  }


  record(rateLimit) {
    let self = this;

    if (!self.started) {
      return;
    }

    if (self.profileDuration > self.MAX_PROFILE_DURATION) {
      self.agent.log('Async profiler: max profiling duration reached.');
      return null;
    }

    if (rateLimit && self.recordCount++ > self.MAX_RECORD_COUNT) {
      self.agent.log('Async profiler: max recording count reached.');
      return null;
    }

    if (self.agent.profilerLock) {
      self.agent.log('Async profiler: profiler lock exists.');
      return null;
    }
    self.agent.profilerLock = true;
    self.agent.log('Async profiler: started.');

    try {
      self.sampleLimitReached = false;
      self.samples.clear();
      self.asyncHook.enable();

      let recordStart = self.hrmillis();

      let stopped = false;
      function _stop() {
        if (stopped) {
          return;
        }
        stopped = true;

        try {
          self.asyncHook.disable();

          // calculate actual record duration
          if (!self.sampleLimitReached) {
            self.profileDuration += self.hrmillis() - recordStart;
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

            self.profileDuration += recordEnd - recordStart;
          }

          self.updateProfile();

          self.samples.clear();
        }
        catch(err) {
          self.agent.exception(err);
        }

        self.agent.profilerLock = false;
        self.agent.log('Async profiler: stopped.');
      }

      let stopTimer = self.agent.setTimeout(() => {
        _stop();
      }, self.MAX_RECORD_DURATION);

      return {
        stop: function() {
          clearTimeout(stopTimer);
          _stop();
        }
      };
    }
    catch(err) {
      self.agent.profilerLock = false;
      self.agent.exception(err);
      return null;
    }
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
        if (self.AGENT_FRAME_REGEXP.exec(callSite.getFileName())) {
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


  report() {
    let self = this;

    if (!self.started) {
      return;
    }

    if (!self.agent.getOption('autoProfiling')) {
      if (self.profileStartTs > Date.now() - self.REPORT_INTERVAL) {
        return;
      } 
      else if (self.profileStartTs < Date.now() - 2 * self.REPORT_INTERVAL) {
        self.reset();
        return;
      }
    }

    if (self.profileDuration === 0) {
      return;
    }

    self.agent.log('Async profiler: reporting profile.');

    self.asyncProfile.propagate();
    self.asyncProfile.normalize(self.profileDuration / 1000);
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

    self.reset();
  }


  hrmillis() {
    const t = process.hrtime();
    return t[0] * 1e3 + t[1] / 1e6;
  }

}

exports.AsyncReporter = AsyncReporter;
