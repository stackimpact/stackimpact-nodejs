'use strict';


class Config {
  constructor(agent) {
    let self = this;

    self.agent = agent;
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
}

exports.Config = Config;
