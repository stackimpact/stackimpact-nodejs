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

  global.agent.config.setAgentEnabled(true);

  global.agent.cpuReporter.start();
  global.agent.allocationReporter.start();
  global.agent.asyncReporter.start();
  global.agent.errorReporter.start();
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




  describe('readMetrics()', () => {
    it('should read metrics in standalone mode', (done) => {
      agent.options.autoProfiling = false;
      agent.options.standalone = true;

      agent.cpuReporter.profileStartTs = Date.now() - 130 * 1000;
      agent.cpuReporter.profileDuration = 1;

      let p = agent.profile();

      setTimeout(() => {
        p.stop();        
        agent.report(() => {
          let metrics = agent.readMetrics();
          assert.equal(metrics[0].category, 'cpu-profile');

          done();
        }, 50);
      });
    });
  });
});
