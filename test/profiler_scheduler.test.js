'use strict';

const assert = require('assert');

const ProfilerScheduler = require('../lib/profiler_scheduler').ProfilerScheduler;


describe('ProfilerScheduler', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('queue()', () => {
    it('should queue two profilers', function(done) {
      let stats = {
        records: 0,
        reports: 0
      };

      let unlock1 = false;

      let ps1 = new ProfilerScheduler(agent, 50000, 10000, 200000, () => {}, () => {});
      ps1.retryInterval = 1;
      ps1.queue((callback) => {
        setTimeout(() => {
          unlock1 = true;
          callback();
        }, 10);
      });

      let ps2 = new ProfilerScheduler(agent, 50000, 10000, 200000, () => {}, () => {});
      ps2.retryInterval = 1;
      ps2.queue(() => {
        assert.equal(unlock1, true);
        done();
      });
    });
  });  


  describe('start()', () => {
    it('should trigger record and report functions', function(done) {
      let stats = {
        records: 0,
        reports: 0
      };

      let recordFunc = function(duration, callback) {
        assert.equal(duration, 10);
        stats.records += 1;

        setTimeout(() => {
          callback();
        }, duration);
      };

      let reportFunc = function(callback) {
        stats.reports += 1;
        callback();
      };

      let ps = new ProfilerScheduler(agent, 50, 10, 200, recordFunc, reportFunc);
      ps.retryInterval = 1;
      ps.start();

      setTimeout(() => {
        assert(stats.records >= 5);
        assert(stats.reports >= 1);

        ps.stop()
        done();
      }, 500);
    });


    it('should execute record and report functions sequentially', function(done) {
      let stats = {
        records: 0,
        reports: 0
      };

      let recordFunc = function(duration, callback) {
        stats.records += 1;

        setTimeout(() => {
          callback();
        }, duration);
      };

      let reportFunc = function(callback) {
        stats.reports += 1;
        callback();
      };

      let ps = new ProfilerScheduler(agent, 200, 200, 300, recordFunc, reportFunc);
      ps.retryInterval = 1;
      ps.start();

      setTimeout(() => {
        assert(stats.records === 1);
        assert(stats.reports === 0);

        ps.stop()
        done();
      }, 350);
    });    
  });

});
