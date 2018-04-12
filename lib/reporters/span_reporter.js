
'use strict';

const Metric = require('../metric').Metric;
const Breakdown = require('../metric').Breakdown;


class SpanReporter {
  
  constructor(agent) {
    let self = this;

    self.REPORT_INTERVAL = 60 * 1000;

    self.agent = agent;
    self.started = false;
    self.reportTimer = undefined;
    self.spanCounters = undefined;
  }


  start() {
    let self = this;

    if (!self.agent.getOption('autoProfiling')) {
      return;
    }

    if (self.started) {
      return;
    }
    self.started = true;

    self.reset();

    self.reportTimer = self.agent.setInterval(() => {
      self.report();
    }, self.REPORT_INTERVAL);
  }


  stop() {
    let self = this;

    if (!self.started) {
      return;
    }
    self.started = false;

    if (self.reportTimer) {
      clearInterval(self.reportTimer);
      self.reportTimer = undefined;
    }
  }


  reset() {
    let self = this;

    self.spanCounters = new Map();
  }


  recordSpan(name, duration) {
    let self = this;

    if (!self.started) {
      return;
    }

    let counter = self.spanCounters.get(name);
    if (!counter) {
        counter = new Breakdown(self.agent, name);
        self.spanCounters.set(name, counter);
    }
    
    counter.updateP95(duration);
  }


  report() {
    let self = this;

    for (let counter of self.spanCounters.values()) {
      counter.evaluateP95();

      let metric = new Metric(self.agent, Metric.c.TYPE_STATE, Metric.c.CATEGORY_SPAN, counter.name, Metric.c.UNIT_MILLISECOND);
      metric.createMeasurement(Metric.c.TRIGGER_TIMER, counter.measurement, 60, null);
      self.agent.messageQueue.add('metric', metric.toJson());
    }

    self.reset();
  }
}

exports.SpanReporter = SpanReporter;
