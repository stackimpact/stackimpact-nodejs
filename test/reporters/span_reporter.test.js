'use strict';

const assert = require('assert');
const SpanReporter = require('../../lib/reporters/span_reporter').SpanReporter;


describe('SpanReporter', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('recordSpan()', () => {
    it('should record span', (done) => {
      agent.spanReporter.reset();

      for (let i = 0; i < 10; i++) {
        agent.spanReporter.recordSpan("span1", 10);
      }

      let spanCounters = agent.spanReporter.spanCounters;
      agent.spanReporter.report();

      let span1Counter = spanCounters.get("span1");

      assert.equal(span1Counter.name, "span1");
      assert.equal(span1Counter.measurement, 10);

      done();
    });
  });
});
