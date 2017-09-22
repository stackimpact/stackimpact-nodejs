'use strict';

const assert = require('assert');


describe('ConfigLoader', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('load()', () => {

    it('should load config', (done) => {
      agent.apiRequest = {
        post: function(endpoint, payload, callback) {
          setTimeout(() => {
            callback(null, null, {profiling_disabled: 'yes'});
            
            assert(agent.config.isProfilingDisabled());

            done();
          }, 1);
        }
      };

      agent.configLoader.load()
    });
  });

});


