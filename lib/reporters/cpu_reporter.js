'use strict';

const os = require('os');
const Metric = require('../metric').Metric;
const Breakdown = require('../metric').Breakdown;


class CpuReporter {
  
  constructor(agent) {
    let self = this;

    self.MAX_PROFILE_DURATION = 10 * 1000;
    self.MAX_RECORD_DURATION = 2 * 1000;
    self.MAX_RECORD_COUNT = 20;
    self.REPORT_INTERVAL = 120 * 1000;
    self.RECORD_INTERVAL = (self.REPORT_INTERVAL / (self.MAX_PROFILE_DURATION / self.MAX_RECORD_DURATION)) * 0.75;
    self.AGENT_FRAME_REGEXP = /node_modules\/stackimpact\//;

    self.agent = agent;
    self.started = false;
    self.recordTimer = undefined;
    self.randomTimer = undefined;
    self.reportTimer = undefined;
    self.profile = undefined;
    self.profileStartTs = undefined;
    self.profileSamples = undefined;
    self.profileDuration = undefined;
    self.recordCount = undefined;
  }


  start() {
    let self = this;

    if (self.agent.getOption('cpuProfilerDisabled')) {
      return;
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


  reset() {
    let self = this;

    self.profile = new Breakdown(self.agent, 'root');
    self.profileStartTs = Date.now();
    self.profileSamples = 0;
    self.profileDuration = 0;
    self.recordCount = 0;
  }


  record() {
    let self = this;

    if (!self.started) {
      return;
    }

    if (self.profileDuration > self.MAX_PROFILE_DURATION) {
      self.agent.log('CPU profiler: max profiling duration reached.');
      return null;
    }

    if (self.recordCount++ > self.MAX_RECORD_COUNT) {
      self.agent.log('CPU profiler: max recording count reached.');
      return null;
    }

    if (self.agent.profilerLock) {
      self.agent.log('CPU profiler: profiler lock exists.');
      return null;
    }
    self.agent.profilerLock = true;
    self.agent.log('CPU profiler: started.');

    try {
      self.agent.addon.startCpuProfiler();
      let recordStart = self.agent.utils.hrmillis();

      let stopped = false;
      function _stop() {
        if (stopped) {
          return;
        }
        stopped = true;

        try {
          self.profileDuration += self.agent.utils.hrmillis() - recordStart;

          let cpuProfileRoot = self.agent.addon.stopCpuProfiler();
          if (cpuProfileRoot) {
            let includeAgentFrames = self.agent.getOption('includeAgentFrames');
            self.updateProfile(self.profile, cpuProfileRoot.children, includeAgentFrames);
          }
        }
        catch(err) {
          self.agent.exception(err);
        }

        self.agent.profilerLock = false;
        self.agent.log('CPU profiler: stopped.');
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


  updateProfile(parent, nodes, includeAgentFrames) {
    let self = this;

    nodes.forEach((node) => {
      self.profileSamples += node.hit_count;

      if (node.func_name === '(program)') {
        return;
      }

      // exclude/include agent frames
      if (node.file_name && 
          !includeAgentFrames && 
          self.AGENT_FRAME_REGEXP.exec(node.file_name)) {
        return;
      }

      let frame;
      if (!node.func_name && !node.file_name) {
        frame = 'unknown';
      }
      else if (!node.file_name) {
        frame = node.func_name;
      }
      else {
        frame = `${node.func_name} (${node.file_name}:${node.line_num}:${node.col_num})`;
      }

      let child = parent.findOrAddChild(frame);

      child.numSamples += node.hit_count;

      self.updateProfile(child, node.children, includeAgentFrames);
    });
  }


  report() {
    let self = this;

    if (!self.started) {
      return;
    }

    if (!self.agent.getOption('autoProfiling') && self.profileStartTs > Date.now() - self.REPORT_INTERVAL) {
      return;
    }

    if (self.profileDuration === 0) {
      return;
    }

    self.agent.log('CPU profiler: reporting profile.');

    self.profile.propagate();
    self.profile.evaluatePercent(self.profileSamples);
    self.profile.filter(2, 1, 100);

    let metric = new Metric(self.agent, Metric.c.TYPE_PROFILE, Metric.c.CATEGORY_CPU_PROFILE, Metric.c.NAME_CPU_USAGE, Metric.c.UNIT_PERCENT);
    metric.createMeasurement(Metric.c.TRIGGER_TIMER, self.profile.measurement, null, self.profile);
    self.agent.messageQueue.add('metric', metric.toJson());

    self.reset();
  }
}

exports.CpuReporter = CpuReporter;

