'use strict';

const os = require('os');
const Metric = require('../metric').Metric;
const Breakdown = require('../metric').Breakdown;


class AllocationReporter {
  
  constructor(agent) {
    let self = this;

    self.MAX_PROFILE_DURATION = 20 * 1000;
    self.MAX_RECORD_DURATION = 4 * 1000;
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
    self.profileDuration = undefined;
    self.recordCount = undefined;
  }


  start() {
    let self = this;

    if (self.agent.getOption('allocationProfilerDisabled')) {
      return;
    }

    if (!self.agent.addon.checkAllocationSampler()) {
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
    self.profileDuration = 0;
    self.recordCount = 0;
  }


  record() {
    let self = this;

    if (!self.started) {
      return;
    }

    if (self.profileDuration > self.MAX_PROFILE_DURATION) {
      self.agent.log('Allocation profiler: max profiling duration reached.');
      return null;
    }

    if (self.recordCount++ > self.MAX_RECORD_COUNT) {
      self.agent.log('Allocation profiler: max recording count reached.');
      return null;
    }

    if (self.agent.profilerLock) {
      self.agent.log('Allocation profiler: profiler lock exists.');
      return null;
    }
    self.agent.profilerLock = true;
    self.agent.log('Allocation profiler: started.');

    try {
      self.agent.addon.startAllocationSampler();
      let recordStart = self.agent.utils.hrmillis();

      let stopped = false;
      function _stop() {
        if (stopped) {
          return;
        }
        stopped = true;

        try {
          self.profileDuration += self.agent.utils.hrmillis() - recordStart;

          let allocationProfileRoot = self.agent.addon.readAllocationProfile();
          self.agent.addon.stopAllocationSampler();
          if (allocationProfileRoot) {
            let includeAgentFrames = self.agent.getOption('includeAgentFrames');
            self.updateProfile(self.profile, allocationProfileRoot.children, includeAgentFrames);
          }
        }
        catch(err) {
          self.agent.exception(err);
        }

        self.agent.profilerLock = false;
        self.agent.log('Allocation profiler: stopped.');
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

      child.measurement += node.size;
      child.numSamples += node.count;

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

    self.agent.log('Allocation profiler: reporting profile.');
    
    self.profile.normalize(self.profileDuration / 1000);
    self.profile.propagate();
    self.profile.floor();
    self.profile.filter(2, 1000, +Infinity);

    let metric = new Metric(self.agent, Metric.c.TYPE_PROFILE, Metric.c.CATEGORY_MEMORY_PROFILE, Metric.c.NAME_HEAP_ALLOCATION_RATE, Metric.c.UNIT_BYTE);
    metric.createMeasurement(Metric.c.TRIGGER_TIMER, self.profile.measurement, 1, self.profile);
    self.agent.messageQueue.add('metric', metric.toJson());

    self.reset();
  }
}

exports.AllocationReporter = AllocationReporter;
