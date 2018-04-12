const stackimpact = require('../..');


const agent = stackimpact.start({
  agentKey: process.env.AGENT_KEY,
  appName: 'MyNodeApp',
  appEnvironment: 'mydevenv',
  autoProfiling: false
});


function simulateMemAllocs() {
  let mem = [];

  setInterval(() => {
    for(let i = 0; i < 1000000; i++) {
      obj = {'v': Math.random()};
      mem.push(obj);
    }
  }, 1000);
}

agent.startAllocationProfiler();

simulateMemAllocs();

setTimeout(() => {
  agent.stopAllocationProfiler(() => {
    // profile reported
    process.exit();
  });
}, 5000);
