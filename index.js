let Agent = require('./lib/agent').Agent;


let agent = null;

exports.start = function(opts) {
  if(!agent) {
    agent = new Agent();
  }

  agent.start(opts);
  return agent;
};
