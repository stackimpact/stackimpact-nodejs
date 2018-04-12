const stackimpact = require('../..');


const agent = stackimpact.start({
  agentKey: process.env.AGENT_KEY,
  appName: 'MyNodeApp',
  appEnvironment: 'mydevenv',
  autoProfiling: false
});


function simulateCpuWork() {
  for(let i = 0; i < 100000000; i++) {
    Math.random();
  }
}

agent.startCpuProfiler();

simulateCpuWork();

agent.stopCpuProfiler(() => {
  // profile reported
});
