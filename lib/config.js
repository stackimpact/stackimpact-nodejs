'use strict';


class Config {
  constructor(agent) {
    let self = this;

    self.agent = agent;
    self.agentEnabled = false;
    self.profilingDisabled = false;
  }

  setProfilingDisabled(val) {
    let self = this;

    self.profilingDisabled = val;
  }


  isProfilingDisabled() {
    let self = this;

    return self.profilingDisabled;
  }


  setAgentEnabled(val) {
    let self = this;

    self.agentEnabled = val;
  }


  isAgentEnabled() {
    let self = this;

    return self.agentEnabled;
  }
}

exports.Config = Config;
