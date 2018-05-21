'use strict';

const os = require('os');
const Metric = require('../metric').Metric;
const Breakdown = require('../metric').Breakdown;


class CpuProfiler {
  
  constructor(agent) {
    let self = this;

    self.agent = agent;

    self.profile = undefined;
    self.profileSamples = undefined;
  }


  test() {
    let self = this;

    if (self.agent.getOption('cpuProfilerDisabled')) {
      return false;
    }

    return true;
  }


  reset() {
    let self = this;

    self.profile = new Breakdown(self.agent, 'CPU call graph', Breakdown.c.TYPE_CALLGRAPH);
    self.profileSamples = 0;
  }


  startProfiler() {
    let self = this;

    self.agent.addon.startCpuProfiler();
  }


  stopProfiler() {
    let self = this;

    let cpuProfileRoot = self.agent.addon.stopCpuProfiler();
    if (cpuProfileRoot) {
      let includeAgentFrames = self.agent.getOption('includeAgentFrames');
      self.updateProfile(self.profile, cpuProfileRoot.children, includeAgentFrames);
    }
  }


  buildProfile(duration) {
    let self = this;

    self.profile.propagate();
    self.profile.evaluatePercent(self.profileSamples);
    self.profile.filter(2, 1, 100);

    return [{
      category: Metric.c.CATEGORY_CPU_PROFILE,
      name: Metric.c.NAME_CPU_USAGE,
      unit: Metric.c.UNIT_PERCENT,
      profile: self.profile
    }];
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

      child.numSamples += node.hit_count;

      self.updateProfile(child, node.children, includeAgentFrames);
    });
  }
}

exports.CpuProfiler = CpuProfiler;

