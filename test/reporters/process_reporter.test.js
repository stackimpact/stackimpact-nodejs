
'use strict';

const assert = require('assert');
const Metric = require('../../lib/metric').Metric;


describe('ErrorReporter', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('report()', () => {
    it('should report metrics', (done) => {

      function isValid(metrics, typ, category, name, minValue, maxValue) {
        let key = typ + category + name;

        assert(metrics[key], key);

        let m = metrics[key];
        if (m.hasMeasurement()) {
          assert(m.measurement.value >= minValue && m.measurement.value <= maxValue, key);
        }
      }


      agent.processReporter.report();

      for (let i = 0; i < 1e6; i++) {
        let s = '' + i;
      }

      agent.processReporter.report();

      let metrics = agent.processReporter.metrics;

      if (typeof(process.cpuUsage) == 'function') {
        isValid(metrics, Metric.c.TYPE_STATE, Metric.c.CATEGORY_CPU, Metric.c.NAME_CPU_USAGE, 0, Infinity);
      }

      if (typeof(process.memoryUsage) == 'function') {
        isValid(metrics, Metric.c.TYPE_STATE, Metric.c.CATEGORY_MEMORY, Metric.c.NAME_RSS, 0, Infinity);
        isValid(metrics, Metric.c.TYPE_STATE, Metric.c.CATEGORY_MEMORY, Metric.c.NAME_USED_HEAP_SIZE, 0, Infinity);
        isValid(metrics, Metric.c.TYPE_STATE, Metric.c.CATEGORY_MEMORY, Metric.c.NAME_TOTAL_HEAP_SIZE, 0, Infinity);
        if (process.memoryUsage().external) {
          isValid(metrics, Metric.c.TYPE_STATE, Metric.c.CATEGORY_MEMORY, Metric.c.NAME_CPP_OBJECTS, 0, Infinity);
        }
      }

      isValid(metrics, Metric.c.TYPE_STATE, Metric.c.CATEGORY_MEMORY, Metric.c.NAME_USED_HEAP_SIZE + ': new_space', 0, Infinity);
      isValid(metrics, Metric.c.TYPE_STATE, Metric.c.CATEGORY_MEMORY, Metric.c.NAME_USED_HEAP_SIZE + ': old_space', 0, Infinity);
      isValid(metrics, Metric.c.TYPE_STATE, Metric.c.CATEGORY_MEMORY, Metric.c.NAME_USED_HEAP_SIZE + ': code_space', 0, Infinity);
      isValid(metrics, Metric.c.TYPE_STATE, Metric.c.CATEGORY_MEMORY, Metric.c.NAME_USED_HEAP_SIZE + ': map_space', 0, Infinity);
      isValid(metrics, Metric.c.TYPE_STATE, Metric.c.CATEGORY_MEMORY, Metric.c.NAME_USED_HEAP_SIZE + ': large_object_space', 0, Infinity);

      isValid(metrics, Metric.c.TYPE_STATE, Metric.c.CATEGORY_GC, Metric.c.NAME_GC_CYCLES, 0, Infinity);
      isValid(metrics, Metric.c.TYPE_STATE, Metric.c.CATEGORY_GC, Metric.c.NAME_GC_TIME, 0, Infinity);

      isValid(metrics, Metric.c.TYPE_STATE, Metric.c.CATEGORY_RUNTIME, Metric.c.NAME_EVENT_LOOP_TICKS, 0, Infinity);
      isValid(metrics, Metric.c.TYPE_STATE, Metric.c.CATEGORY_RUNTIME, Metric.c.NAME_EVENT_LOOP_IO_STAGE, 0, Infinity);

      done();
    });
  });
});

