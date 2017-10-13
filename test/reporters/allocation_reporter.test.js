
'use strict';

const assert = require('assert');


describe('AllocationReporter', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('record()', () => {
    it('should record allocation profile', (done) => {
      if (!agent.addon.checkAllocationSampler()) {
        done();
        return;
      }

      let rec = agent.allocationReporter.record();
      setTimeout(() => {
        rec.stop();

        //console.log(agent.allocationReporter.profile.dump());
        assert(agent.allocationReporter.profile.dump().match(/allocation_reporter.test.js/));
        done();
      }, 500);


      let mem1 = [];
      function memLeak() {
        let mem2 = [];
        for(let i = 0; i < 100000; i++) {
          mem1.push(Math.random())
          mem2.push(Math.random())
        }
      }

      memLeak();
    });
  });


});


