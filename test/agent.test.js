'use strict';

const assert = require('assert');
const Agent = require('../lib/agent').Agent;

beforeEach(() => {
  global.agent = new Agent();
  global.agent.start({
    dashboardAddress: 'http://localhost:5001',
    agentKey: 'key1',
    appName: 'app1',
    appEnvironment: 'env1',
    appVersion: 'v1',
    debug: true,
    cpuProfilerDisabled: false,
    allocationProfilerDisabled: false 
  });
});

afterEach(() => {
  global.agent.destroy();
  global.agent = undefined;
});


describe('Agent', () => {
  describe('start()', () => {
    it('should not start the agent twice', (done) => {
      let runId = agent.runId;

      agent.start({
        agentKey: 'key1',
        appName: 'app1'
      });

      assert.equal(runId, agent.runId);

      assert(!!agent.addon.readHeapStats);

      done();
    });
  });
});
