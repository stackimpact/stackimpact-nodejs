'use strict';


const MESSAGE_TTL = 10 * 60;


class MessageQueue {

  constructor(agent) {
    let self = this;

    self.agent = agent;
    self.queue = undefined;
    self.flushTimer = undefined;
    self.expireTimer = undefined;
    self.backoffSeconds = undefined;
    self.lastFlushTs = undefined;
  }


  start() {
    let self = this;

    self.reset();

    self.expireTimer = self.agent.setInterval(function() {
      self.expire();
    }, 60 * 1000);

    self.flushTimer = self.agent.setInterval(function() {
      self.flush();
    }, 5 * 1000);
  }


  stop() {
    let self = this;

    if (self.flushTimer) {
      clearInterval(self.flushTimer);
      self.flushTimer = undefined;
    }

    if (self.expireTimer) {
      clearInterval(self.expireTimer);
      self.expireTimer = undefined;
    }
  }


  reset() {
    let self = this;

    self.backoffSeconds = 0;
    self.lastFlushTs = 0;
    self.queue = [];
  }


  add(topic, message) {
    let self = this;

    let m = {
      topic: topic,
      content: message,
      added_at: self.agent.utils.timestamp()
    };

    self.queue.push(m);

    self.agent.log('Added message to the queue for topic: ' + topic);
  }



  expire() {
    let self = this;

    if (self.queue.length === 0) {
      return;
    }

    let now = self.agent.utils.timestamp();

    self.queue = self.queue.filter(function(m) { 
      return m.added_at >= now - MESSAGE_TTL;
    });
  }

      
  flush() {
    let self = this;

    if (self.queue.length === 0) {
      return;
    }

    let now = self.agent.utils.timestamp();

    // flush only if backoff time is elapsed
    if (self.lastFlushTs + self.backoffSeconds > now) {
      return;
    }

    // read queue
    let outgoing = self.queue;
    self.queue = [];

    let payload = {
      messages: []
    };

    outgoing.forEach(function(m) {
      payload.messages.push({
        topic: m.topic,
        content: m.content,      
      });
    });

    self.lastFlushTs = self.agent.utils.timestamp();

    self.agent.apiRequest.post('upload', payload, function(err, res, config) {
      if (err) {
        self.agent.log('Error uploading messages to the dashboard, backing off next upload');
        self.agent.exception(err);

        self.queue = outgoing.concat(self.queue);

        // increase backoff up to 1 minute
        if (self.backoffSeconds === 0) {
          self.backoffSeconds = 10;
        }
        else if (self.backoffSeconds * 2 < 60) {
          self.backoffSeconds *= 2;
        }
      }
      else {
        // reset backoff
        self.backoffSeconds = 0;      
      }
    });
  }
}

exports.MessageQueue = MessageQueue;
