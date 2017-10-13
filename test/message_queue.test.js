'use strict';

const assert = require('assert');


describe('MessageQueue', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('flush()', () => {

    it('should send messages and empty the queue', (done) => {
      let lastPayload;
  
      agent.apiRequest = {
        post: function(endpoint, payload, callback) {
          lastPayload = payload;

          setTimeout(() => {
            callback(null);

            assert.equal(agent.messageQueue.queue.length, 0);
            done();
          }, 1);
        }
      };

      let m = {
        'm0': 1
      };
      agent.messageQueue.add('t0', m);
      agent.messageQueue.queue[0]['added_at'] = Date.now() - 20 * 60 * 1000;

      m = {
        'm1': 1
      };
      agent.messageQueue.add('t1', m)

      m = {
        'm2': 2
      };
      agent.messageQueue.add('t1', m)

      agent.messageQueue.flush(() => {
        assert.equal(lastPayload['messages'][0]['content']['m1'], 1);
        assert.equal(lastPayload['messages'][1]['content']['m2'], 2);        
      });

    });


    it('should fail to send messages and restore the queue', (done) => {
      agent.apiRequest = {
        post: function(endpoint, payload, callback) {
          setTimeout(() => {
            callback(new Error('some error'));

            assert.equal(agent.messageQueue.queue[0]['content']['m1'], 1);
            assert.equal(agent.messageQueue.queue[1]['content']['m2'], 2);
            assert.equal(agent.messageQueue.queue[2]['content']['m3'], 3);
            assert.equal(agent.messageQueue.queue.length, 3);

            done();
          }, 1);
        }
      };

      let m = {
        'm1': 1
      };
      agent.messageQueue.add('t1', m)

      m = {
        'm2': 2
      };
      agent.messageQueue.add('t1', m)

      agent.messageQueue.flush((err) => {});

      m = {
        'm3': 3
      };
      agent.messageQueue.add('t1', m)
    });
  });
});
