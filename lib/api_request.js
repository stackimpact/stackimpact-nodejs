'use strict';

const http = require('http');
const https = require('https');
const url = require('url');
const zlib = require('zlib');


class ApiRequest {

  constructor(agent) {
    let self = this;
    
    self.agent = agent;
  }
  

  post(endpoint, payload, callback) {
    let self = this;

    let parts = url.parse(self.agent.getOption('dashboardAddress') + '/agent/v1/' + endpoint);
    let opts = {
      hostname: parts.hostname,
      port: parts.port,
      method: 'POST',
      path: parts.path,
      headers: {
        'Host': parts.hostname,
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
        'Accept-Encoding': 'gzip',
        'Authorization': 'Basic ' + new Buffer(self.agent.getOption('agentKey') + ':').toString('base64')
      }
    };

    let startMs = Date.now();

    let body = [];
    let req = (parts.protocol == 'http:' ? http : https).request(opts, function(res) {
      let stream;
      if (res.headers['content-encoding'] === 'gzip') {
        stream = zlib.createGunzip();
        res.pipe(stream);
      }
      else {
        stream = res;
      }

      stream.on('data', function(chunk) {
        body.push(chunk);
      });
      stream.on('end', function() {
        try {
          let buf = Buffer.concat(body);

          self.agent.log('ApiRequest: ' + endpoint + ' request took ' + (Date.now() - startMs) + 'ms');
          self.agent.log(opts);

          if (res.statusCode !== 200) {
            callback(new Error(buf.toString('utf8')), res);
          }
          else {
            callback(null, res, JSON.parse(buf.toString('utf8')));
          }
        }
        catch(err) {
          callback(err);
        }
      });
    });

    req.useChunkedEncodingByDefault = true;

    req.setTimeout(20 * 1000, function() {
      callback(new Error('request sending timeout'));
    });

    req.on('error', function(err) {
      callback(err);
    });

    if (payload !== null) {
      let data = {
        'runtime_type':    'node.js',
        'runtime_version': process.version,
        'agent_version':   self.agent.version,
        'app_name':        self.agent.getOption('appName'),
        'app_version':     self.agent.getOption('appVersion'),
        'app_environment': self.agent.getOption('appEnvironment'),
        'host_name':       self.agent.getOption('hostName'),
        'process_id':      process.pid,
        'run_id':          self.agent.runId,
        'run_ts':          self.agent.runTs,
        'sent_at':         self.agent.utils.timestamp(),
        'payload':         payload
      };

      zlib.gzip(JSON.stringify(data), function(err, dataGzip) {
        if (err) return callback(err);

        req.write(dataGzip);
        req.end();
      });
    }
    else {
      req.end();
    }
  }

}

exports.ApiRequest = ApiRequest;
