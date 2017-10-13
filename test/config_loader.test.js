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
          }, 1);
        }
      };

      agent.configLoader.load((err) => {
        assert.ifError(err);

        assert(agent.config.isProfilingDisabled());

        done();
      });
    });
  });

});


