'use strict';

const assert = require('assert');
const http = require('http');
const fs = require('fs');


describe('AsyncReporter', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });

  describe('extractFrames()', () => {
    it('should extract frames', (done) => {
      if (!agent.minVersion(8, 1, 0)) {
        done();
        return;
      }

      function generateStackTrace(skip) {
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function(error, structuredStackTrace) {
          return structuredStackTrace;
        };

        var stack = new Error().stack;

        Error.prepareStackTrace = orig;

        if (stack) {
          return stack.slice(skip);
        }
        else {
          return null;
        }
      }

      let sample = {
        asyncId: 1,
        stack: generateStackTrace(0)
      };

      agent.asyncReporter.samples = new Map();
      agent.asyncReporter.samples.set(1, sample);

      let frames = agent.asyncReporter.createStackTrace(sample, true);

      let found = false;
      frames.forEach((frame) => {
        if(frame.match(/async_reporter.test.js/)) {
          found = true;
        }
      });

      assert(found);

      done();
    });

  });


  describe('record()', () => {
    it('should record async profile', (done) => {
      if (!agent.minVersion(8, 1, 0)) {
        done();
        return;
      }

      const server = http.createServer((req, res) => {
        fs.readFile('/tmp', () => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Hello World\n');
        });
      });

      let timer;
      server.listen(5001, '127.0.0.1', () => {
        //let startCpuTime = process.cpuUsage();
        let rec = agent.asyncReporter.record();
        setTimeout(() => {
          rec.stop();

          //let endCpuTime = process.cpuUsage(startCpuTime)
          //console.log('CPU time:', (endCpuTime.user + endCpuTime.system) / 1e6);

          //console.log(agent.asyncReporter.asyncProfile.dump());
          assert(agent.asyncReporter.asyncProfile.dump().match(/async_reporter.test.js/));

          done();
        }, 1000);

        timer = setInterval(() => {
          http.get('http://localhost:5001', (resp) => {
            let data = '';
           
            resp.on('data', (chunk) => {
              data += chunk;
            });
           
            resp.on('end', () => {
            });
          }).on("error", (err) => {
            console.log("Error: " + err.message);
          });
        }, 10);

      });

      setTimeout(() => {
        clearInterval(timer);
        server.close();
      }, 1000);
    });
  });  

});
