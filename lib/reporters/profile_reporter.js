'use strict';

const os = require('os');
const Metric = require('../metric').Metric;


class ProfileReporter {
  
  constructor(agent, profiler, config) {
    let self = this;

    self.agent = agent;
    self.profiler = profiler;
    self.config = config;
    self.started = false;
    self.spanTimer = undefined;
    self.randomTimer = undefined;
    self.reportTimer = undefined;
    self.profileStartTs = undefined;
    self.profileDuration = undefined;
    self.spanCount = undefined;
    self.spanTrigger = undefined;
  }


  start() {
    let self = this;

    if (!self.profiler.test()) {
      return;
    }

    if (self.started) {
      return;
    }
    self.started = true;

    self.reset();

    if (self.agent.getOption('autoProfiling')) {
      if (!self.config.reportOnly) {
        self.spanTimer = self.agent.setInterval(() => {
          self.randomTimer = self.agent.setTimeout(() => {
            self.profile(false, true);
          }, Math.round(Math.random() * (self.config.spanInterval - self.config.maxSpanDuration)));
        }, self.config.spanInterval);
      }

      self.reportTimer = self.agent.setInterval(() => {
        self.report(false);
      }, self.config.reportInterval);
    }
  }


  stop() {
    let self = this;

    if (!self.started) {
      return;
    }
    self.started = false;

    if (self.spanTimer) {
      clearInterval(self.spanTimer);
      self.spanTimer = undefined;
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

    self.profiler.reset();
    self.profileStartTs = Date.now();
    self.profileDuration = 0;
    self.spanCount = 0;
    self.spanTrigger = Metric.c.TRIGGER_TIMER;
  }


  profile(apiCall, withTimeout) {
    let self = this;

    if (!self.started) {
      return;
    }

    if (self.profileDuration > self.config.maxProfileDuration) {
      self.agent.log(self.config.logPrefix + ': max profiling duration reached.');
      return null;
    }

    if (apiCall && self.spanCount > self.config.maxSpanCount) {
      self.agent.log(self.config.logPrefix + ': max recording count reached.');
      return null;
    }

    if (self.agent.profilerActive) {
      self.agent.log(self.config.logPrefix + ': profiler lock exists.');
      return null;
    }
    self.agent.profilerActive = true;
    self.agent.log(self.config.logPrefix + ': started.');

    if (apiCall) {
      self.spanTrigger = Metric.c.TRIGGER_API;
    }

    try {
      self.profiler.startProfiler();

      let spanStart = self.agent.utils.hrmillis();
      self.spanCount++;

      let stopped = false;
      function _stop() {
        if (stopped) {
          return;
        }
        stopped = true;

        try {
          self.profileDuration += self.agent.utils.hrmillis() - spanStart;
          self.profiler.stopProfiler();
        }
        catch(err) {
          self.agent.exception(err);
        }

        self.agent.profilerActive = false;
        self.agent.log(self.config.logPrefix + ': stopped.');
      }

      if (withTimeout) {
        let stopTimer = self.agent.setTimeout(() => {
          _stop();
        }, self.config.maxSpanDuration);

        return {
          stop: function() {
            clearTimeout(stopTimer);
            _stop();
          }
        };
      }
      else {
        return {
          stop: function() {
            _stop();
          }
        };
      }
    }
    catch(err) {
      self.agent.profilerActive = false;
      self.agent.exception(err);
      return null;
    }
  }


  report(withInterval) {
    let self = this;

    if (!self.started) {
      return;
    }

    if (withInterval) {
      if (self.profileStartTs > Date.now() - self.config.reportInterval) {
        return;
      } 
      else if (self.profileStartTs < Date.now() - 2 * self.config.reportInterval) {
        self.reset();
        return;
      }
    }

    if (!self.config.reportOnly && self.profileDuration === 0) {
      return;
    }

    self.agent.log(self.config.logPrefix + ': reporting profile.');

    let profileData = self.profiler.buildProfile(self.profileDuration);

    profileData.forEach((d) => {
      let metric = new Metric(self.agent, Metric.c.TYPE_PROFILE, d.category, d.name, d.unit);
      metric.createMeasurement(self.spanTrigger, d.profile.measurement, d.unitInterval, d.profile);
      self.agent.messageQueue.add('metric', metric.toJson());
    });

    self.reset();
  }
}

exports.ProfileReporter = ProfileReporter;
