'use strict';

const assert = require('assert');
const http = require('http');
const os = require('os');
const zlib = require('zlib');


describe('ApiRequest', () => {
  let agent;
  
  beforeEach(() => {
    agent = global.agent;
  });


  describe('post()', () => {
    it('should send and receive data', (done) => {
      let lastPayload;

      let server = http.createServer(function(req, res) {
        let stream = zlib.createGunzip();
        req.pipe(stream);

        let body = [];
        stream.on('data', function(chunk) {
          body.push(chunk);
        });
        stream.on('end', () => {
          let buf = Buffer.concat(body);

          lastPayload = JSON.parse(buf.toString('utf8'));

          zlib.gzip(JSON.stringify({b: 2}), function(err, dataGzip) {
            if (err) return callback(err);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Encoding', 'gzip');
            res.write(dataGzip);
            res.end();
          });
        });
      });

      server.listen(5001, '127.0.0.1', () => {
        agent.apiRequest.post('test', {a: 1}, function(err, res, data) {
          assert.ifError(err);

          assert.equal(lastPayload['run_id'], agent.runId);
          assert.equal(lastPayload['run_ts'], agent.runTs);
          assert.equal(lastPayload['process_id'], process.pid);
          assert.equal(lastPayload['host_name'], os.hostname());
          assert.equal(lastPayload['runtime_type'], 'node.js');
          assert.equal(lastPayload['runtime_version'], process.version);
          assert.equal(lastPayload['agent_version'], agent.version);
          assert.equal(lastPayload['app_name'], 'app1');
          assert.equal(lastPayload['app_environment'], 'env1');
          assert.equal(lastPayload['app_version'], 'v1');
          assert.deepEqual(lastPayload['payload'], {'a': 1});

          assert.deepEqual(data, {b: 2});
    
          server.close();

          done();
        });
      });
    });
  });
});
