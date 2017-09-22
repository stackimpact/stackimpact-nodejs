
'use strict';

const assert = require('assert');


describe('CpuReporter', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('recordProfile()', () => {
    it('should record profile', (done) => {
      agent.cpuReporter.record(500, (err) => {
        assert.ifError(err);
      });

      for(let i = 0; i < 60 * 20000; i++) {
        let text = 'text' + i;
        text = text + 'text2';
      }

      setTimeout(() => {
        //console.log(agent.cpuReporter.profile.dump());
        assert(agent.cpuReporter.profile.dump().match(/cpu_reporter.test.js/));
        done();
      }, 600);
    });
  });


});
