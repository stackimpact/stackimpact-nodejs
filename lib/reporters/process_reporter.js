'use strict';

const os = require('os');
const Metric = require('../metric').Metric;


class ProcessReporter {
  
  constructor(agent) {
    let self = this;

    self.frameRegexp = /^\s+at\s+(.*)$/;

    self.agent = agent;
    self.reportTimer = undefined;
    self.metrics = {};
    self.lastCpuTime = null;
  }


  start() {
    let self = this;

    self.reportTimer = self.agent.setInterval(() => {
      self.report();
    }, 60 * 1000);

    self.agent.addon.startGCStats();
    self.agent.addon.startEventLoopStats();
  }


  destroy() {
    let self = this;

    self.agent.addon.stopGCStats();
    self.agent.addon.stopEventLoopStats();

    if (self.reportTimer) {
      clearInterval(self.reportTimer);
      self.reportTimer = undefined;
    }
  }


  report() {
    let self = this;

    if (typeof(process.cpuUsage) === 'function') {
      let cu = process.cpuUsage();
      let cpuTime = cu.user + cu.system;

      if (self.lastCpuTime) {
        let cpuUsage = ((cpuTime - self.lastCpuTime) / (60 * 1e6)) * 100;
        self.reportMetric(Metric.c.TYPE_STATE, Metric.c.CATEGORY_CPU, Metric.c.NAME_CPU_USAGE, Metric.c.UNIT_PERCENT, cpuUsage);
      }

      self.lastCpuTime = cpuTime;
    }


    if (typeof(process.memoryUsage) === 'function') {
      let mu = process.memoryUsage();

      if (typeof(mu.rss) === 'number') {
        self.reportMetric(Metric.c.TYPE_STATE, Metric.c.CATEGORY_MEMORY, Metric.c.NAME_RSS, Metric.c.UNIT_BYTE, mu.rss);
      }

      if (typeof(mu.heapTotal) === 'number') {
        self.reportMetric(Metric.c.TYPE_STATE, Metric.c.CATEGORY_MEMORY, Metric.c.NAME_TOTAL_HEAP_SIZE, Metric.c.UNIT_BYTE, mu.heapTotal);
      }

      if (typeof(mu.heapUsed) === 'number') {
        self.reportMetric(Metric.c.TYPE_STATE, Metric.c.CATEGORY_MEMORY, Metric.c.NAME_USED_HEAP_SIZE, Metric.c.UNIT_BYTE, mu.heapUsed);
      }

      if (typeof(mu.external) === 'number') {
        self.reportMetric(Metric.c.TYPE_STATE, Metric.c.CATEGORY_MEMORY, Metric.c.NAME_CPP_OBJECTS, Metric.c.UNIT_BYTE, mu.external);
      }
    }


    let heapStats = self.agent.addon.readHeapStats();
    if (heapStats && heapStats.spaces) {
      heapStats.spaces.forEach((space) => {
        self.reportMetric(Metric.c.TYPE_STATE, Metric.c.CATEGORY_MEMORY, Metric.c.NAME_USED_HEAP_SIZE + ': ' + space.space_name, Metric.c.UNIT_BYTE, space.space_used_size);
      });
    }


    let gcStats = self.agent.addon.readAndResetGCStats();
    if (gcStats) {
      self.reportMetric(Metric.c.TYPE_STATE, Metric.c.CATEGORY_GC, Metric.c.NAME_GC_CYCLES, Metric.c.UNIT_NONE, gcStats.num_cycles, 60);
      self.reportMetric(Metric.c.TYPE_STATE, Metric.c.CATEGORY_GC, Metric.c.NAME_GC_TIME, Metric.c.UNIT_NANOSECOND, gcStats.total_time, 60);
    }


    let eventLoopStats = self.agent.addon.readAndResetEventLoopStats();
    if (eventLoopStats) {
      self.reportMetric(Metric.c.TYPE_STATE, Metric.c.CATEGORY_RUNTIME, Metric.c.NAME_EVENT_LOOP_TICKS, Metric.c.UNIT_NONE, eventLoopStats.num_ticks, 60);
      self.reportMetric(Metric.c.TYPE_STATE, Metric.c.CATEGORY_RUNTIME, Metric.c.NAME_EVENT_LOOP_IO_STAGE, Metric.c.UNIT_NANOSECOND, eventLoopStats.io_time, 60);
    }
  }


  reportMetric(typ, category, name, unit, value, duration) {
    let self = this;

    let key = typ + category + name;

    let metric;
    if (!self.metrics[key]) {
      metric = new Metric(self.agent, typ, category, name, unit);
      self.metrics[key] = metric;
    }
    else {
      metric = self.metrics[key];
    }

    metric.createMeasurement(Metric.c.TRIGGER_TIMER, value, duration);

    if (metric.hasMeasurement()) {
      self.agent.messageQueue.add('metric', metric.toJson());
    }

    return metric;
  }
}

exports.ProcessReporter = ProcessReporter;

