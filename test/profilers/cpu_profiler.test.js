
'use strict';

const CpuProfiler = require('../../lib/profilers/cpu_profiler').CpuProfiler;
const assert = require('assert');


describe('CpuProfiler', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('startProfile()', () => {
    it('should record profile', (done) => {
      let profiler = new CpuProfiler(agent);
      if (!profiler.test()) {
        done();
        return;
      }
      profiler.reset();

      profiler.startProfiler();

      setTimeout(() => {
        profiler.stopProfiler();
        let profiles = profiler.buildProfile(500);

        assert(profiles[0].profile.dump().match(/cpu_profiler.test.js/));
        done();
      }, 500);

      for(let i = 0; i < 60 * 20000; i++) {
        let text = 'text' + i;
        text = text + 'text2';
      }
    });
  });

});
