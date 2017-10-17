'use strict';


class MessageQueue {

  constructor(agent) {
    let self = this;

    self.FLUSH_INTERVAL = 5 * 1000;
    self.MESSAGE_TTL = 10 * 60 * 1000;

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

    if (self.agent.getOption('autoProfiling')) {
      self.flushTimer = self.agent.setInterval(function() {
        self.flush((err) => {
          if (err) {
            self.agent.log('Error uploading messages');
            self.agent.exception(err);
          }
        });
      }, self.FLUSH_INTERVAL);
    }
  }


  stop() {
    let self = this;

    if (self.flushTimer) {
      clearInterval(self.flushTimer);
      self.flushTimer = undefined;
    }
  }


  reset() {
    let self = this;

    self.backoffSeconds = 0;
    self.lastFlushTs = Date.now();
    self.queue = [];
  }


  add(topic, message) {
    let self = this;

    let m = {
      topic: topic,
      content: message,
      added_at: Date.now()
    };

    self.queue.push(m);

    self.agent.log('Added message to the queue for topic: ' + topic);
  }


  flush(callback) {
    let self = this;

    let now = Date.now();

    if (!self.agent.getOption('autoProfiling') && self.lastFlushTs > now - self.FLUSH_INTERVAL) {
      return callback(null);
    }

    if (self.queue.length === 0) {
      return callback(null);
    }

    // flush only if backoff time is elapsed
    if (self.lastFlushTs + self.backoffSeconds > now) {
      return callback(null);
    }

    // expire old messages
    self.queue = self.queue.filter(function(m) { 
      return m.added_at >= now - self.MESSAGE_TTL;
    });

    // no upload in standalone mode
    if (self.agent.getOption('standalone')) {
      return callback(null);
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

    self.lastFlushTs = now;

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

        callback(err);
      }
      else {
        // reset backoff
        self.backoffSeconds = 0;

        callback(null);
      }
    });
  }
}

exports.MessageQueue = MessageQueue;
