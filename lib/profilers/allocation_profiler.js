'use strict';

const os = require('os');
const Metric = require('../metric').Metric;
const Breakdown = require('../metric').Breakdown;


class AllocationProfiler {
  
  constructor(agent) {
    let self = this;

    self.agent = agent;
    self.started = false;
    self.profile = undefined;
  }


  test() {
    let self = this;

    if (self.agent.getOption('allocationProfilerDisabled')) {
      return false;
    }

    if (!self.agent.addon.checkAllocationSampler()) {
      return false;
    }

    return true;
  }


  reset() {
    let self = this;

    self.profile = new Breakdown(self.agent, 'Allocation call graph', Breakdown.c.TYPE_CALLGRAPH);
  }


  startProfiler() {
    let self = this;

    self.agent.addon.startAllocationSampler();
  }


  stopProfiler() {
    let self = this;

    let allocationProfileRoot = self.agent.addon.readAllocationProfile();
    self.agent.addon.stopAllocationSampler();
    if (allocationProfileRoot) {
      let includeAgentFrames = self.agent.getOption('includeAgentFrames');
      self.updateProfile(self.profile, allocationProfileRoot.children, includeAgentFrames);
    }
  }


  updateProfile(parent, nodes, includeAgentFrames) {
    let self = this;

    nodes.forEach((node) => {
      // exclude/include agent frames
      if (node.file_name && 
          !includeAgentFrames && 
          self.agent.AGENT_FRAME_REGEXP.exec(node.file_name)) {
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
      child.setType(Breakdown.c.TYPE_CALLSITE);

      child.measurement += node.size;
      child.numSamples += node.count;

      self.updateProfile(child, node.children, includeAgentFrames);
    });
  }


  buildProfile(duration) {
    let self = this;

    self.profile.normalize(duration / 1000);
    self.profile.propagate();
    self.profile.floor();
    self.profile.filter(2, 1000, +Infinity);

    return [{
      category: Metric.c.CATEGORY_MEMORY_PROFILE,
      name: Metric.c.NAME_HEAP_ALLOCATION_RATE,
      unit: Metric.c.UNIT_BYTE,
      unitInterval: 1,
      profile: self.profile
    }];
  }
}

exports.AllocationProfiler = AllocationProfiler;
