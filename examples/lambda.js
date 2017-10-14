const stackimpact = require('..');


const agent = stackimpact.start({
  agentKey: process.env.AGENT_KEY,
  appName: 'ExampleNodejsLambda',
  appEnvironment: 'prod',
  autoProfiling: false,
  cpuProfilerDisabled: false,
  allocationProfilerDisabled: false,
  debug: true
});


function simulateCpuWork() {
  for(let i = 0; i < 1000000; i++) {
    Math.random();
  }
}


let mem;
function simulateMemAlloc() {
  let mem = [];
  for(let i = 0; i < 10000; i++) {
    mem.push({v: i});
  }
}


exports.handler = function(event, context, callback) {
  const span = agent.profile();

  simulateCpuWork();
  simulateMemAlloc();

  let response = {
    statusCode: 200,
    body: 'Done'
  };
  
  span.stop(() => {
    callback(null, response);
  });
};



// Simulate events.
// Delete if deploying as lambda function.
setInterval(() => {
  exports.handler({}, {}, () => {
    console.log('RequestResponse');
  });
}, 1000);
