'use strict';

class ConfigLoader {

  constructor(agent) {
    let self = this;

    self.agent = agent;

    self.LOAD_DELAY = 2 * 1000;
    self.LOAD_INTERVAL = 120 * 1000;

    self.delayTimer = undefined;
    self.loadTimer = undefined;

    self.lastLoadTs = 0;
  }


  start() {
    let self = this;

    if (self.agent.getOption('autoProfiling')) {
      self.delayTimer = self.agent.setTimeout(() => {
        self.loadTimer = self.agent.setInterval(() => {
          self.load((err) => {
            if(err) {
              self.agent.log('Error loading config');
              self.agent.exception(err);
            }
          });
        }, self.LOAD_INTERVAL);

        self.load((err) => {
          if(err) {
            self.agent.log('Error loading config');
            self.agent.exception(err);
          }
        });
      }, self.LOAD_DELAY);
    }
  }


  stop() {
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


  load(callback) {
    let self = this;

    let now = Date.now();
    if (!self.agent.getOption('autoProfiling') && self.lastLoadTs > now - self.LOAD_INTERVAL) {
      return callback(null);
    }
    self.lastLoadTs = now;

    self.agent.apiRequest.post('config', {}, (err, res, config) => {
      if (err) {
        return callback(err);
      }

      if (config['agent_enabled'] === 'yes') {
        self.agent.config.setAgentEnabled(config['agent_enabled'] == 'yes');
      }
      else {
        self.agent.config.setAgentEnabled(false);
      }

      if (config['profiling_disabled'] === 'yes') {
        self.agent.config.setProfilingDisabled(config['profiling_disabled'] == 'yes');
      }
      else {
        self.agent.config.setProfilingDisabled(false);
      }

      if (self.agent.config.isAgentEnabled() && !self.agent.config.isProfilingDisabled()) {
        self.agent.cpuReporter.start();
        self.agent.allocationReporter.start();
        self.agent.asyncReporter.start();
        self.agent.spanReporter.start();
      }
      else {
        self.agent.cpuReporter.stop();
        self.agent.allocationReporter.stop();
        self.agent.asyncReporter.stop();
        self.agent.spanReporter.stop();
      }

      if (self.agent.config.isAgentEnabled()) {
        self.agent.errorReporter.start();
        self.agent.processReporter.start();
        self.agent.log('Agent activated.');
      }
      else {
        self.agent.errorReporter.stop();
        self.agent.processReporter.stop();
        self.agent.log('Agent deactivated.');
      }

      callback(null);
    });
  }
}

exports.ConfigLoader = ConfigLoader;
