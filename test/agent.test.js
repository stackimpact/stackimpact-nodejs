'use strict';

const fs = require('fs');
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

  global.agent.config.setAgentEnabled(true);

  global.agent.cpuReporter.start();
  global.agent.allocationReporter.start();
  global.agent.asyncReporter.start();
  global.agent.errorReporter.start();
  global.agent.spanReporter.start();
  global.agent.processReporter.start();
});

afterEach(() => {
  global.agent.destroy();
  global.agent = undefined;
});


describe('Agent', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('start()', () => {
    it('should match version', (done) => {
      assert.equal(agent.matchVersion(null, null), true);
      assert.equal(agent.matchVersion("0.0.0", "v100.100.100"), true);
      assert.equal(agent.matchVersion("v100.100.100", "v110.110.110"), false);

      done();
    });
  });

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


  describe('profile()', () => {
    it('should trigger profiling', (done) => {
      let p = agent.profile();

      setTimeout(() => {
        p.stop();
        agent.report(() => {
          assert(
            agent.cpuReporter.profileDuration > 0 ||
            agent.allocationReporter.profileDuration > 0 ||
            agent.asyncReporter.profileDuration > 0);
          done();
        }, 50);
      });
    });


    it('should report profiles when autoProfilng=false', (done) => {
      agent.options.autoProfiling = false;

      let configDone = false;
      let uploadDone = false;

      agent.apiRequest = {
        post: function(endpoint, payload, callback) {
          if (endpoint == 'config') {
            configDone = true;
          }

          if (endpoint == 'upload') {
            if (payload.messages[0].content.type === 'profile') {
              uploadDone = true;
            }
          }

          callback(null, {}, {agent_enabled: 'yes'});
        }
      };

      let p = agent.profile();

      setTimeout(() => {
        p.stop();

        agent.cpuReporter.profileStartTs = Date.now() - 130 * 1000;
        agent.cpuReporter.profileDuration = 1;
        agent.allocationReporter.profileStartTs = Date.now() - 130 * 1000;
        agent.allocationReporter.profileDuration = 1;
        agent.asyncReporter.profileStartTs = Date.now() - 130 * 1000;
        agent.asyncReporter.profileDuration = 1;
        agent.messageQueue.lastFlushTs = agent.utils.timestamp() - 20;

        agent.report(() => {
          assert(configDone);
          assert(uploadDone);

          done();
        }, 50);
      });
    });
  });


  describe('startCpuProfiler()', () => {
    it('should report CPU profile', (done) => {
      if (!agent.cpuReporter.profiler.test()) {
        done();
        return;
      }

      agent.options.autoProfiling = false;

      let profileJson = '';

      agent.apiRequest = {
        post: function(endpoint, payload, callback) {
          if (endpoint == 'upload') {
            if (payload.messages[0].content.type === 'profile') {
              profileJson = payload.messages[0].content;
            }
          }

          callback(null, {}, {agent_enabled: 'yes'});
        }
      };

      agent.startCpuProfiler();

      for(let i = 0; i < 60 * 20000; i++) {
        let text = 'text' + i;
        text = text + 'text2';
      }

      agent.stopCpuProfiler(() => {
        assert(JSON.stringify(profileJson).match(/agent\.test\.js/));

        done();        
      });
    });
  });


  describe('startAllocationProfiler()', () => {
    it('should report allocation profile', (done) => {
      if (!agent.matchVersion("v8.6.0", null)) {
        done();
        return;
      }

      agent.options.autoProfiling = false;

      let profileJson = '';

      agent.apiRequest = {
        post: function(endpoint, payload, callback) {
          if (endpoint == 'upload') {
            if (payload.messages[0].content.type === 'profile') {
              profileJson = payload.messages[0].content;
            }
          }

          callback(null, {}, {agent_enabled: 'yes'});
        }
      };

      agent.startAllocationProfiler();

      let mem = [];
      for(let i = 0; i < 100000; i++) {
        mem.push(Math.random())
      }

      agent.stopAllocationProfiler(() => {
        assert(JSON.stringify(profileJson).match(/agent\.test\.js/));

        done();        
      });
    });
  });


  describe('startAsyncProfiler()', () => {
    it('should report async profile', (done) => {
      if (!agent.asyncReporter.profiler.test()) {
        done();
        return;
      }

      agent.options.autoProfiling = false;

      let profileJson = '';

      agent.apiRequest = {
        post: function(endpoint, payload, callback) {
          if (endpoint == 'upload') {
            if (payload.messages[0].content.type === 'profile') {
              profileJson = payload.messages[0].content;
            }
          }

          callback(null, {}, {agent_enabled: 'yes'});
        }
      };

      agent.startAsyncProfiler();

      fs.readFile('/tmp', (err) => {
        agent.stopAsyncProfiler(() => {
          assert(JSON.stringify(profileJson).match(/agent\.test\.js/));

          done();        
        });
      });

    });
  });  


});
