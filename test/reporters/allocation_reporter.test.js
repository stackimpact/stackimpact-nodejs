
'use strict';

const assert = require('assert');


describe('AllocationReporter', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('readProfile()', () => {
    it('should read allocation profile', (done) => {
      if (!agent.addon.checkAllocationSampler()) {
        done();
        return;
      }

      let mem1 = [];
      function memLeak() {
        let mem2 = [];
        for(let i = 0; i < 100000; i++) {
          mem1.push(Math.random())
          mem2.push(Math.random())
        }
      }

      memLeak();

      let profile = agent.allocationReporter.readProfile();
      //console.log(profile.dump());
      
      assert(profile.dump().match(/allocation_reporter.test.js/));

      done();
    });
  });


});


