
'use strict';

const AllocationProfiler = require('../../lib/profilers/allocation_profiler').AllocationProfiler;
const assert = require('assert');


describe('AllocationProfiler', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('startProfiler()', () => {
    it('should record allocation profile', (done) => {
      if (!agent.matchVersion("v8.6.0", null)) {
        done();
        return
      }

      let profiler = new AllocationProfiler(agent);
      if (!profiler.test()) {
        done();
        return;
      }
      profiler.reset();

      profiler.startProfiler();
      setTimeout(() => {
        profiler.stopProfiler();
        let profiles = profiler.buildProfile(1000);

        //console.log(profiles[0].profile.dump());
        assert(profiles[0].profile.dump().match(/allocation_profiler.test.js/));
        done();
      }, 1000);


      let mem1 = [];
      function memLeak() {
        let mem2 = [];
        for(let i = 0; i < 200000; i++) {
          mem1.push(Math.random())
          mem2.push(Math.random())
        }
      }

      memLeak();
    });
  });


});


