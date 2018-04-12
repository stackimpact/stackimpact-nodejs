const https = require('https');
const stackimpact = require('../..');


const agent = stackimpact.start({
  agentKey: process.env.AGENT_KEY,
  appName: 'MyNodeApp',
  appEnvironment: 'mydevenv',
  autoProfiling: false
});


function simulateAsyncWork() {
  setInterval(() => {
    var req = https.get('https://stackimpact.com', (res) => {
    });

    req.on('error', function(err) {
      console.log(err.message);
    });
  }, 1000);
}

agent.startAsyncProfiler();

simulateAsyncWork();

setTimeout(() => {
  agent.stopAsyncProfiler(() => {
    // profile reported
    process.exit();
  });
}, 5000);
