const fs = require('fs');
const http = require('http');
const stackimpact = require('..');


// StackImpact agent initialization
let agent = stackimpact.start({
  dashboardAddress: process.env.DASHBOARD_ADDRESS,
  agentKey: process.env.AGENT_KEY,
  appName: 'ExampleNodejsApp',
  appVersion: '1.0.0',
  cpuProfilerDisabled: false,
  allocationProfilerDisabled: false,
  debug: true
});



process.on('uncaughtException', (err) => {
  // overwrites default exit behaviour
  //console.log(err);
});

process.on('unhandledRejection', (err) => {
  // overwrites default exit behaviour
  //console.log(err);
});


function cpuWork(usage, duration) {
  let usageTimer = setInterval(() => {
    for(let i = 0; i < usage * 300000; i++) {
      Math.random();
    }
  }, 1000);

  if(duration) {
    setTimeout(() => {
      clearInterval(usageTimer);
    }, duration * 1000);
  }
}


function simulateCpu() {
  cpuWork(15);

  setInterval(() => {
    cpuWork(50, 240);
  }, 1200 * 1000);
}


function simulateMemLeak() {
  let mem1 = [];
  var n = 0;

  // 30 min
  setInterval(() => {
    if(n++ > 1800) {
      mem1 = [];
      n = 0;
    }

    for(let i = 0; i < 10000; i++) {
      obj1 = {'v': Math.random()};
      mem1.push(obj1);
    }
  }, 1000);

  // 5 sec
  setInterval(() => {
    let mem2 = [];
    for(let i = 0; i < 1000; i++) {
      obj2 = {'v': Math.random()};
      mem2.push(obj2);
    }
  }, 5000);
}


function simulateHttp() {
  setInterval(() => {

    var options = {
      host: '127.0.0.1',
      port: 5005
    };

    var req = http.get(options, (res) => {
    });

    req.on('error', function(err) {
      console.log(err.message);
    });
  }, 1000);
}


function simulateProgrammaticProfiling() {
  setInterval(() => {
    let span = agent.profile();

    for(let i = 0; i < usage * 300000; i++) {
      Math.random();
    }

    span.stop();
  }, 1000);
}


function simulateExceptions() {
  setInterval(() => {
    if(Math.random() > 0.2) {
      setTimeout(() => {
        throw new Error('some error ' + Math.round(Math.random() * 10));
      }, 1);
    }
  }, 5 * 1000);
}


function simulateRejections() {
  setInterval(() => {
    if(Math.random() > 0.2) {
      setTimeout(() => {
        Promise.reject(new Error('some rejection'));
      }, 1);
    }
  }, 5 * 1000);
}


const server = http.createServer((req, res) => {
  fs.readFile('/tmp', () => {
    setTimeout(() => {
      cpuWork(10, 2);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Hello World\n');
    }, 500);
  });
});

server.listen(5005, '127.0.0.1', () => {
  console.log('App running');

  simulateCpu();
  simulateMemLeak();
  simulateHttp();
  simulateProgrammaticProfiling();
  simulateExceptions();
  simulateRejections();
});
