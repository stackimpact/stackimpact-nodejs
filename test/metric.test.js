'use strict';

const assert = require('assert');
const Metric = require('../lib/metric').Metric;
const Breakdown = require('../lib/metric').Breakdown;


describe('Metric', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('constructor()', () => {
    it('should counter metric', (done) => {
      let m = new Metric(agent, Metric.c.TYPE_COUNTER, Metric.c.CATEGORY_CPU, Metric.c.NAME_CPU_USAGE, Metric.c.UNIT_NONE);

      m.createMeasurement(Metric.c.TRIGGER_TIMER, 100);
      assert(!m.hasMeasurement());

      m.createMeasurement(Metric.c.TRIGGER_TIMER, 110);
      assert.equal(m.measurement.value, 10);

      m.createMeasurement(Metric.c.TRIGGER_TIMER, 115);
      assert.equal(m.measurement.value, 5);

      done();
    });
  });


  describe('toJson()', () => {
    it('should convert metric to json', (done) => {
      let m = new Metric(agent, Metric.c.TYPE_PROFILE, Metric.c.CATEGORY_CPU, Metric.c.NAME_CPU_USAGE, Metric.c.UNIT_PERCENT);

      let root = new Breakdown(agent, 'root');
      root.measurement = 10;
      root.numSamples = 1;

      let child1 = new Breakdown(agent, 'package1.func1');
      child1.measurement = 5;
      child1.numSamples = 1;
      root.addChild(child1);

      let ts = agent.utils.timestamp();
      m.createMeasurement(Metric.c.TRIGGER_TIMER, 100, 1, root, ts);

      assert.deepEqual(m.toJson(), {
        id: m.id,
        type: 'profile',
        category: 'cpu',
        name: 'CPU usage',
        unit: 'percent',
        measurement: {
          id: m.measurement.id,
          trigger: 'timer',
          value: 100,
          duration: 1,
          breakdown: { 
          name: 'root',
            measurement: 10,
            num_samples: 1,
            children: [
              {
                name: 'package1.func1',
                measurement: 5,
                num_samples: 1,
                children: []
              }
            ]
          },
          timestamp: ts 
        }
      });

      done();
    });
  });

});


describe('Breakdown', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('filter()', () => {
    it('should filter breakdown', (done) => {
      let root = new Breakdown(agent, 'root');
      root.measurement = 10;

      let child1 = new Breakdown(agent, 'child1');
      child1.measurement = 9;
      root.addChild(child1);

      let child2 = new Breakdown(agent, 'child2');
      child2.measurement = 1;
      root.addChild(child2);

      let child2child1 = new Breakdown(agent, 'child2child1');
      child2child1.measurement = 1;
      child2.addChild(child2child1);

      root.filter(2, 3, 100);

      assert(root.findChild('child1'));
      assert(root.findChild('child2'));
      assert(!child2.findChild('child2child1'));

      done();
    });
  });


  describe('depth()', () => {
    it('should return max depth', (done) => {
      let root = new Breakdown(agent, "root");

      let child1 = new Breakdown(agent, "child1");
      root.addChild(child1);

      let child2 = new Breakdown(agent, "child2");
      root.addChild(child2);

      let child2child1 = new Breakdown(agent, "child2child1");
      child2.addChild(child2child1);

      assert.equal(root.depth(), 3);
      assert.equal(child1.depth(), 1);
      assert.equal(child2.depth(), 2);

      done();
    });
  });  


  describe('addChild()', () => {
    it('should add child', (done) => {
      let root = new Breakdown(agent, "root");

      let child1 = new Breakdown(agent, "child1");
      root.addChild(child1);

      assert.deepEqual(child1, root.findChild('child1'));

      done();
    });
  });


  describe('removeChild()', () => {
    it('should remove child', (done) => {
      let root = new Breakdown(agent, "root");

      let child1 = new Breakdown(agent, "child1");
      root.removeChild(child1);

      assert(!root.findChild('child1'));

      done();
    });
  });


  describe('increment()', () => {
    it('should increment value', (done) => {
      let b = new Breakdown(agent, "root");
      b.increment(0.1, 1);
      b.increment(0.2, 2);

      assert.equal(b.measurement.toFixed(1), 0.3);
      assert.equal(b.numSamples, 3);
      done();
    });
  });


  describe('propagate()', () => {
    it('should propagate values upstream', (done) => {
      let root = new Breakdown(agent, "root");
      root.measurement = 1;
      root.numSamples = 1;

      let child = new Breakdown(agent, "child");
      child.measurement = 2;
      child.numSamples = 1;
      root.addChild(child);

      root.propagate();

      assert.equal(root.measurement, 3);
      assert.equal(root.numSamples, 2);

      done();
    });
  });


  describe('evaluatePercent()', () => {
    it('should calculate percentage', (done) => {
      let root = new Breakdown(agent, "root");
      root.numSamples = 4;

      let child = new Breakdown(agent, "child");
      child.numSamples = 2;
      root.addChild(child);

      root.evaluatePercent(10);

      assert.equal(root.measurement, 40);
      assert.equal(child.measurement, 20);

      done();
    });
  });


  describe('convertToPercent()', () => {
    it('should convert value to percentage', (done) => {
      let root = new Breakdown(agent, "root");
      root.measurement = 4;

      let child = new Breakdown(agent, "child");
      child.measurement = 2;
      root.addChild(child);

      root.convertToPercent(10);

      assert.equal(root.measurement, 40);
      assert.equal(child.measurement, 20);

      done();
    });
  });


  describe('normalize()', () => {
    it('should normalize tree', (done) => {
      let root = new Breakdown(agent, "root");
      root.measurement = 20;

      let child = new Breakdown(agent, "child");
      child.measurement = 10;
      root.addChild(child);

      root.normalize(5);

      assert.equal(root.measurement, 4);
      assert.equal(child.measurement, 2);

      done();
    });
  });


  describe('evaluateP95()', () => {
    it('should update and calculate 95th percentile', (done) => {
      let root = new Breakdown("root");

      let child1 = new Breakdown("child1");
      root.addChild(child1);

      let child2 = new Breakdown("child2");
      root.addChild(child2);

      let child2child1 = new Breakdown("child2child1");
      child2.addChild(child2child1);

      child2child1.updateP95(6.5)
      child2child1.updateP95(4.2)
      child2child1.updateP95(5.0)
      child2child1.evaluateP95()
      root.propagate()

      assert.equal(root.measurement, 6.5);

      done();
    });
  });

});
