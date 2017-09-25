'use strict';


class ProfilerScheduler {

  constructor(agent, recordInterval, recordDuration, reportInterval, recordFunc, reportFunc) {
    let self = this;


    self.agent = agent;
    self.recordInterval = recordInterval;
    self.recordDuration = recordDuration;
    self.reportInterval = reportInterval;
    self.recordFunc = recordFunc;
    self.reportFunc = reportFunc;
    self.recordTimer = undefined;
    self.randomTimer = undefined;
    self.reportTimer = undefined;
    self.retryTimer = undefined;
    self.retryInterval = 500;
  }


  start() {
    let self = this;

    if (self.recordFunc) {
      self.recordTimer = self.agent.setInterval(function() {
        let randomTimeout = Math.round(Math.random() * (self.recordInterval - self.recordDuration));
    
        self.randomTimer = self.agent.setTimeout(function() {
          self.executeRecord();
        }, randomTimeout);
      }, self.recordInterval);
    }

    self.reportTimer = self.agent.setInterval(function() {
      self.executeReport();
    }, self.reportInterval);

    self.retryTimer = null;
  }


  stop() {
    let self = this;

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

    if (self.retryTimer) {
      clearInterval(self.retryTimer);
      self.retryTimer = undefined;
    }
  }


  executeRecord() {
    let self = this;

    self.queue((callback) => {
      self.recordFunc(self.recordDuration, callback);
    });
  }


  executeReport() {
    let self = this;

    self.queue((callback) => {
      self.reportFunc(callback);
    });
  }


  queue(func) {
    let self = this;

    if (self.retryTimer) {
      // already queued
      return;
    }

    function execute() {
      self.agent.profilerLock = true;
      try {
        func(() => {
          self.agent.profilerLock = false;         
        });
      }
      catch(err) {
        self.agent.exception(err);
        self.agent.profilerLock = false;
      }
    }

    if (!self.agent.profilerLock) {
      execute();
      return;
    }

    self.retryTimer = self.agent.setInterval(function() {
      if (!self.agent.profilerLock) {
        clearInterval(self.retryTimer);
        self.retryTimer = null;
        execute();
      }
    }, self.retryInterval);
  }
}

exports.ProfilerScheduler = ProfilerScheduler;

