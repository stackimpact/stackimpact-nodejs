'use strict';

const os = require('os');
const ProfilerScheduler = require('../profiler_scheduler').ProfilerScheduler;
const Metric = require('../metric').Metric;
const Breakdown = require('../metric').Breakdown;


class AllocationReporter {
  
  constructor(agent) {
    let self = this;

    self.agentFrameRegexp = /node_modules\/stackimpact\//;

    self.agent = agent;
    self.started = false;
    self.profilerScheduler = undefined;
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

    self.agent.addon.startAllocationSampler();

    self.profilerScheduler = new ProfilerScheduler(
        self.agent, 
        null, null, 120 * 1000,
        null,
        (callback) => { self.report(callback); });
    self.profilerScheduler.start();
  }


  stop() {
    let self = this;

    if (!self.started) {
      return;
    }
    self.started = false;

    self.profilerScheduler.stop();
    self.profilerScheduler = undefined;
  }


  readProfile() {
    let self = this;

    self.agent.log('Reading allocation profile.');

    let allocationProfileRoot = self.agent.addon.readAllocationProfile();
    if (!allocationProfileRoot) {
      return null;
    }

    let includeAgentFrames = self.agent.getOption('includeAgentFrames');
    let profile = new Breakdown(self.agent, 'root');

    self.updateProfile(profile, allocationProfileRoot.children, includeAgentFrames);

    return profile;
  }


  updateProfile(parent, nodes, includeAgentFrames) {
    let self = this;

    nodes.forEach((node) => {
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

      child.measurement += node.size;
      child.numSamples += node.count;

      self.updateProfile(child, node.children, includeAgentFrames);
    });
  }


  report(callback) {
    let self = this;

    let profile = self.readProfile();
    if (!profile) {
      callback();
      return;
    }

    profile.propagate();
    profile.filter(1, 1000, +Infinity);

    let metric = new Metric(self.agent, Metric.c.TYPE_PROFILE, Metric.c.CATEGORY_MEMORY_PROFILE, Metric.c.NAME_HEAP_ALLOCATION, Metric.c.UNIT_BYTE);
    metric.createMeasurement(Metric.c.TRIGGER_TIMER, profile.measurement, null, profile);
    self.agent.messageQueue.add('metric', metric.toJson());

    callback();
  }
}

exports.AllocationReporter = AllocationReporter;
