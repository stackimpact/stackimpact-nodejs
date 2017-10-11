'use strict';

const Metric = require('../metric').Metric;
const Breakdown = require('../metric').Breakdown;


class ErrorReporter {
  
  constructor(agent) {
    let self = this;

    self.frameRegexp = /^\s+at\s+(.*)$/;

    self.agent = agent;
    self.started = false;
    self.reportTimer = undefined;
    self.exceptionProfile = undefined;
    self.rejectionProfile = undefined;
    self.exceptionListener = undefined;
    self.rejectionListener = undefined;
  }


  start() {
    let self = this;

    if (self.agent.getOption('errorProfilerDisabled')) {
      return;
    }

    if (self.started) {
      return;
    }
    self.started = true;

    self.reset();

    self.reportTimer = self.agent.setInterval(() => {
      self.report();
    }, 60 * 1000);

    // only register if there are other handlers, otherwise do not alter default behaviour
    self.agent.setTimeout(() => {
      if (process.listenerCount('uncaughtException') > 0) {
        self.exceptionListener = function(err) {
          self.updateProfile(self.exceptionProfile, err);
        };
        process.on('uncaughtException', self.exceptionListener);
      }

      if (process.listenerCount('unhandledRejection') > 0) {
        self.rejectionListener = function(err) {
          self.updateProfile(self.rejectionProfile, err);
        };
        process.on('unhandledRejection', self.rejectionListener);
      }
    }, 2 * 1000);
  }


  stop() {
    let self = this;

    if (!self.started) {
      return;
    }
    self.started = false;

    if (self.exceptionListener) {
      process.removeListener('uncaughtException', self.exceptionListener);
    }

    if (self.rejectionListener) {
      process.removeListener('unhandledRejection', self.rejectionListener);
    }

    if (self.reportTimer) {
      clearInterval(self.reportTimer);
      self.reportTimer = undefined;
    }
  }


  reset() {
    let self = this;

    self.exceptionProfile = new Breakdown(self.agent, 'root');
    self.rejectionProfile = new Breakdown(self.agent, 'root');
  }


  report() {
    let self = this;

    if (self.exceptionListener) {
      let metric = new Metric(self.agent, Metric.c.TYPE_PROFILE, Metric.c.CATEGORY_ERROR_PROFILE, Metric.c.NAME_UNCAUGHT_EXCEPTIONS, Metric.c.UNIT_NONE);
      metric.createMeasurement(Metric.c.TRIGGER_TIMER, self.exceptionProfile.measurement, 60, self.exceptionProfile);
      self.agent.messageQueue.add('metric', metric.toJson());
    }

    if (self.rejectionListener) {
      let metric = new Metric(self.agent, Metric.c.TYPE_PROFILE, Metric.c.CATEGORY_ERROR_PROFILE, Metric.c.NAME_UNHANDLED_REJECTIONS, Metric.c.UNIT_NONE);
      metric.createMeasurement(Metric.c.TRIGGER_TIMER, self.rejectionProfile.measurement, 60, self.rejectionProfile);
      self.agent.messageQueue.add('metric', metric.toJson());
    }

    self.reset();
  }


  updateProfile(profile, err) {
    let self = this;

    if (!err || !(err instanceof Error)) {
      return;
    }

    let currentNode = profile;
    currentNode.increment(1, 0);

    let frames = self.extractFrames(err);
    if (frames.length === 0) {
      return;
    }

    frames.reverse().forEach((frame) => {
      currentNode = currentNode.findOrAddChild(frame);
      currentNode.increment(1, 0);
    });

    let message = err.message || 'Undefined';
    let messageNode = currentNode.findChild(message);
    if (!messageNode) {
      if (currentNode.children.size < 5) {
        messageNode = currentNode.findOrAddChild(message);
      }
      else {
        messageNode = currentNode.findOrAddChild('Other');
      }
    }

    messageNode.increment(1, 0);
  }


  extractFrames(err) {
    let self = this;

    let frames = [];

    if (!err.stack) {
      return frames;
    }

    let lines = err.stack.split('\n');
    if (lines.length < 2) {
      return frames;
    }

    lines.shift();

    lines.forEach(function(line) {
      let m = self.frameRegexp.exec(line);
      if (m && m.length == 2) {
        frames.push(m[1]);
      }
    });

    return frames;
  }
}

exports.ErrorReporter = ErrorReporter;

