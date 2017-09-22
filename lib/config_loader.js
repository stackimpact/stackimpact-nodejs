'use strict';

class ConfigLoader {

  constructor(agent) {
    let self = this;

    self.agent = agent;
    self.delayTimer = undefined;
    self.loadTimer = undefined;
  }


  start() {
    let self = this;

    self.delayTimer = self.agent.setTimeout(() => {
      self.loadTimer = self.agent.setInterval(() => {
        self.load();
      }, 120 * 1000);

      self.load();
    }, 2 * 1000);
  }


  destroy() {
    let self = this;

    if (self.delayTimer) {
      clearTimeout(self.delayTimer);
      self.delayTimer = undefined;
    }

    if (self.loadTimer) {
      clearInterval(self.loadTimer);
      self.loadTimer = undefined;
    }
  }


  load() {
    let self = this;

    self.agent.apiRequest.post('config', {}, function(err, res, config) {
      if (err) {
        self.agent.log('Error loading config');
        self.agent.exception(err);
        return;
      }

      if (config['profiling_disabled'] === 'yes') {
        self.agent.config.setProfilingDisabled(config['profiling_disabled'] == 'yes');
      }
      else {
        self.agent.config.setProfilingDisabled(false);
      }
    });
  }
}

exports.ConfigLoader = ConfigLoader;
