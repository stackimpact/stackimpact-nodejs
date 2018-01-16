'use strict';

const AsyncProfiler = require('../../lib/profilers/async_profiler').AsyncProfiler;

const assert = require('assert');
const http = require('http');
const fs = require('fs');


describe('AsyncProfiler', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });

  describe('extractFrames()', () => {
    it('should extract frames', (done) => {
      let profiler = new AsyncProfiler(agent);
      if (!profiler.test()) {
        done();
        return;
      }
      profiler.reset();

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

      profiler.samples = new Map();
      profiler.samples.set(1, sample);

      let frames = profiler.createStackTrace(sample, true);

      let found = false;
      frames.forEach((frame) => {
        if(frame.match(/async_profiler.test.js/)) {
          found = true;
        }
      });

      assert(found);

      done();
    });

  });


  describe('startProfiling()', () => {
    it('should record async profile', (done) => {
      let profiler = new AsyncProfiler(agent);
      if (!profiler.test()) {
        done();
        return;
      }
      profiler.reset();

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
        profiler.startProfiler();
        setTimeout(() => {
          profiler.stopProfiler();
          let profiles = profiler.buildProfile(1000);

          //let endCpuTime = process.cpuUsage(startCpuTime)
          //console.log('CPU time:', (endCpuTime.user + endCpuTime.system) / 1e6);

          //console.log(profiles[0].profile.dump());
          assert(profiles[0].profile.dump().match(/async_profiler.test.js/));

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
