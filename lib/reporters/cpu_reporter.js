'use strict';

const os = require('os');
const ProfilerScheduler = require('../profiler_scheduler').ProfilerScheduler;
const Metric = require('../metric').Metric;
const Breakdown = require('../metric').Breakdown;


class CpuReporter {
  
  constructor(agent) {
    let self = this;

    self.agentFrameRegexp = /node_modules\/stackimpact\//;

    self.agent = agent;
    self.profileScheduler = undefined;
    self.profile = undefined;
    self.profileSamples = 0;
    self.stopTimer = undefined;
  }


  start() {
    let self = this;

    if (self.agent.getOption('cpuProfilerDisabled')) {
      return;
    }

    self.resetProfile();

    self.profilerScheduler = new ProfilerScheduler(
        self.agent, 
        10 * 1000, 2 * 1000, 120 * 1000,
        (duration, callback) => { self.record(duration, callback); },
        (callback) => { self.report(callback); });
    self.profilerScheduler.start();
  }


  destroy() {
    let self = this;

    if (self.agent.getOption('cpuProfilerDisabled')) {
      return;
    }

    if (self.profileScheduler) {
      self.profileScheduler.destroy();
      self.profileScheduler = undefined;
    }

    if (self.stopTimer) {
      clearTimeout(self.stopTimer);
      self.stopTimer = undefined;
      self.agent.addon.stopCpuProfiler();
    }
  }


  resetProfile() {
    let self = this;

    self.profile = new Breakdown(self.agent, 'root');
    self.profileSamples = 0;
  }


  record(duration, callback) {
    let self = this;

    self.agent.addon.startCpuProfiler();
    self.stopTimer = self.agent.setTimeout(() => {
      try {
        self.stopTimer = null;

        let cpuProfileRoot = self.agent.addon.stopCpuProfiler();
        if (!cpuProfileRoot) {
          callback();
          return;
        }

        let includeAgentFrames = self.agent.getOption('includeAgentFrames');
        self.updateProfile(self.profile, cpuProfileRoot.children, includeAgentFrames);
      }
      catch(err) {
        self.agent.exception(err);
      }

      callback();
    }, duration);
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
          self.agentFrameRegexp.exec(node.file_name)) {
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


  report(callback) {
    let self = this;

    if (self.agent.config.isProfilingDisabled()) {
      callback();
      return;
    }

    self.profile.propagate();
    self.profile.evaluatePercent(self.profileSamples);
    self.profile.filter(2, 1, 100);

    let metric = new Metric(self.agent, Metric.c.TYPE_PROFILE, Metric.c.CATEGORY_CPU_PROFILE, Metric.c.NAME_CPU_USAGE, Metric.c.UNIT_PERCENT);
    metric.createMeasurement(Metric.c.TRIGGER_TIMER, self.profile.measurement, null, self.profile);
    self.agent.messageQueue.add('metric', metric.toJson());

    self.resetProfile();

    callback();
  }
}

exports.CpuReporter = CpuReporter;

