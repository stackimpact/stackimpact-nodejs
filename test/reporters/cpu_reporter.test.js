
'use strict';

const assert = require('assert');


describe('CpuReporter', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('recordProfile()', () => {
    it('should record profile', (done) => {
      let rec = agent.cpuReporter.record();
      setTimeout(() => {
        rec.stop();

        assert(agent.cpuReporter.profile.dump().match(/cpu_reporter.test.js/));
        done();
      }, 500);

      for(let i = 0; i < 60 * 20000; i++) {
        let text = 'text' + i;
        text = text + 'text2';
      }
    });
  });


});
