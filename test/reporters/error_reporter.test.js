'use strict';

const assert = require('assert');


describe('ErrorReporter', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('updateProfile()', () => {
    it('should update profile with new frames', (done) => {
      agent.errorReporter.resetProfiles();

      for (let i = 0; i < 10; i++) {
        agent.errorReporter.updateProfile(agent.errorReporter.exceptionProfile, new Error('some error ' + i));
      }

      assert(agent.errorReporter.exceptionProfile.dump().match(/error_reporter.test.js/));

      done();
    });
  });


  describe('extractFrames()', () => {
    it('should extract frames from error stack', (done) => {
      let frames = agent.errorReporter.extractFrames(new Error('some error'));

      let found = false;
      frames.forEach((frame) => {
        if (frame.match(/error_reporter.test.js/)) {
          found = true;
        }
      });

      assert(found);

      done();
    });
  });
});
