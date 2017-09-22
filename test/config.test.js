'use strict';

const assert = require('assert');


describe('Config', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('isProfilingDisabled()', () => {
    it('should set get profiling disabled flag', (done) => {
      assert(!agent.config.isProfilingDisabled());
      agent.config.setProfilingDisabled(true);
      assert(agent.config.isProfilingDisabled());

      done();
    });
  });
});
