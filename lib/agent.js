'use strict';

const pkg = require(__dirname + '/../package.json');
const abiMap = require(__dirname + '/../abi-map.json');
const os = require('os');
const Utils = require('./utils').Utils;
const ApiRequest = require('./api_request').ApiRequest;
const Config = require('./config').Config;
const ConfigLoader = require('./config_loader').ConfigLoader;
const MessageQueue = require('./message_queue').MessageQueue;
const ProcessReporter = require('./reporters/process_reporter').ProcessReporter;
const ProfileReporter = require('./reporters/profile_reporter').ProfileReporter;
const CpuProfiler = require('./profilers/cpu_profiler').CpuProfiler;
const AllocationProfiler = require('./profilers/allocation_profiler').AllocationProfiler;
const AsyncProfiler = require('./profilers/async_profiler').AsyncProfiler;
const SpanReporter = require('./reporters/span_reporter').SpanReporter;
const ErrorReporter = require('./reporters/error_reporter').ErrorReporter;

class Agent {

  constructor() {
    let self = this;

    self.AGENT_FRAME_REGEXP = /node_modules\/stackimpact\//;
    self.SAAS_DASHBOARD_ADDRESS = 'https://agent-api.stackimpact.com';

    self.version = pkg.version;

    self.addon = undefined;

    self.agentStarted = false;
    self.agentDestroyed = false;

    self.runTs = undefined;
    self.runId = undefined;

    self.utils = new Utils(self);
    self.apiRequest = new ApiRequest(self);
    self.config = new Config(self);
    self.configLoader = new ConfigLoader(self);
    self.messageQueue = new MessageQueue(self);
    self.processReporter = new ProcessReporter(self);
    self.cpuReporter = new ProfileReporter(self, new CpuProfiler(self), {
      logPrefix: "CPU profiler",
      maxProfileDuration: 10 * 1000,
      maxSpanDuration: 2 * 1000,
      maxSpanCount: 30,
      spanInterval: 16 * 1000,
      reportInterval: 120 * 1000,
    });
    self.allocationReporter = new ProfileReporter(self, new AllocationProfiler(self), {
      logPrefix: "Allocation profiler",
      maxProfileDuration: 20 * 1000,
      maxSpanDuration: 4 * 1000,
      maxSpanCount: 30,
      spanInterval: 16 * 1000,
      reportInterval: 120 * 1000
    });
    self.asyncReporter = new ProfileReporter(self, new AsyncProfiler(self), {
      logPrefix: "Async profiler",
      maxProfileDuration: 20 * 1000,
      maxSpanDuration: 4 * 1000,
      maxSpanCount: 30,
      spanInterval: 16 * 1000,
      reportInterval: 120 * 1000
    });
    self.spanReporter = new SpanReporter(self);
    self.errorReporter = new ErrorReporter(self);

    self.options = undefined;

    self.isProfiling = false;
    self.profilerActive = false;
    self.manualSpan = undefined;

    self.exitHandlerFunc = undefined;
  }


  getOption(name, defaultVal) {
    let self = this;

    if (!self.options || !self.options[name]) {
      return defaultVal;
    }
    else {
      return self.options[name];
    }
  }


  loadAddon(addonPath) {
    let self = this;

    try {
      self.addon = require(addonPath);
    }
    catch(err) {
      // not found
      return false;
    }

    if (self.addon) {
      try {
        // test the addon
        if (self.addon.readHeapStats()) {
          return true;
        }
      }
      catch(err) {
        self.exception(err);
      }
    }

    return false;
  }


  start(opts) {
    let self = this;

    self.options = opts;

    if (!self.matchVersion('v4.0.0', null)) {
      throw new Error('Supported Node.js version 4.0.0 or higher');
    }

    if (opts.autoProfiling === undefined) {
      opts.autoProfiling = true;
    }

    // disable CPU profiler by default for 7.0.0-8.9.3 because of the memory leak.
    if (opts.cpuProfilerDisabled === undefined && 
        (self.matchVersion('v7.0.0', 'v8.9.3') || self.matchVersion('v9.0.0', 'v9.2.1'))) {
      self.log('CPU profiler disabled.');
      opts.cpuProfilerDisabled = true;
    }

    // disable allocation profiler by default up to version 8.5.0 because of segfaults.
    if (opts.allocationProfilerDisabled === undefined && self.matchVersion(null, 'v8.5.0')) {
      self.log('Allocation profiler disabled.');
      opts.allocationProfilerDisabled = true;
    }

    // load native addon
    let addonNotFound = false;

    let abi = abiMap[process.version];
    if (abi) {
      let addonPath = `../addons/${os.platform()}-${process.arch}/stackimpact-addon-v${abi}.node`;
      if (!self.loadAddon(addonPath)) {
        addonNotFound = true;
      }
      else {
        self.log('Using pre-built native addon.');
      }
    }

    if (addonNotFound) {
      if (!self.loadAddon('../build/Release/stackimpact-addon.node')) {
        throw new Error('Finding/loading of native addon failed.');
      }
      else {
        self.log('Using built native addon.');      
      }      
    }

    if (self.agentDestroyed) {
      self.log('Destroyed agent cannot be started');
      return;
    }

    if (self.agentStarted) {
      return;
    }

    if (!self.options['dashboardAddress']) {
      self.options['dashboardAddress'] = self.SAAS_DASHBOARD_ADDRESS;
    }

    if (!self.options['agentKey']) {
      throw new Error('missing option: agentKey');
    }

    if (!self.options['appName']) {
      throw new Error('missing option: appName');
    }

    if (!self.options['hostName']) {
      self.options['hostName'] = os.hostname();
    }    

    self.runId = self.utils.generateUuid();
    self.runTs = self.utils.timestamp();

    self.configLoader.start();
    self.messageQueue.start();


    self.exitHandlerFunc = function() {
      if (!self.agentStarted || self.agentDestroyed) {
        return;
      }

      try {
        self.destroy();
      }
      catch(err) {
        self.exception(err);
      }
    };

    process.once('exit', self.exitHandlerFunc);

    self.agentStarted = true;
    self.log('Agent started');
  }


  destroy() {
    let self = this;

    if (!self.agentStarted) {
      self.log('Agent has not been started');
      return;
    }

    if (self.agentDestroyed) {
      return;
    }

    process.removeListener('exit', self.exitHandlerFunc);

    self.cpuReporter.stop();
    self.allocationReporter.stop();
    self.asyncReporter.stop();
    self.spanReporter.stop();
    self.errorReporter.stop();
    self.processReporter.stop();
    self.configLoader.stop();
    self.messageQueue.stop();

    self.agentDestroyed = true;
    self.log('Agent destroyed');
  }


  enable() {
    let self = this;

    if (!self.config.isAgentEnabled()) {
      self.config.setAgentEnabled(true);
      self.cpuReporter.start();
      self.allocationReporter.start();
      self.asyncReporter.start();
      self.spanReporter.start();
      self.errorReporter.start();
      self.processReporter.start();
    }
  }


  disable() {
    let self = this;

    if (self.config.isAgentEnabled()) {
      self.cpuReporter.stop();
      self.allocationReporter.stop();
      self.asyncReporter.stop();
      self.spanReporter.stop();
      self.errorReporter.stop();
      self.processReporter.stop();
      self.config.setAgentEnabled(false);
    }
  }


  startProfiler(reporter) {
    let self = this;

    if (!self.agentStarted || self.getOption('autoProfiling')) {
      return;
    }

    if (self.manualSpan) {
      return;
    }

    self.isProfiling = true;
    reporter.start();
    self.manualSpan = reporter.profile(true, false);
  }


  stopProfiler(reporter, callback) {
    let self = this;

    if (!self.agentStarted || self.getOption('autoProfiling')) {
      return callback();
    }

    if (!self.manualSpan) {
      return callback();
    }

    self.manualSpan.stop();
    self.isProfiling = false;
    reporter.report(false);
    reporter.stop();
    self.messageQueue.flush(false, (err) => {
      if (err) {
        self.exception(err);
      }

      return callback();
    });
  }


  startCpuProfiler() {
    let self = this;

    self.startProfiler(self.cpuReporter);
  }


  stopCpuProfiler(callback) {
    let self = this;

    self.stopProfiler(self.cpuReporter, callback);
  }


  startAsyncProfiler() {
    let self = this;

    self.startProfiler(self.asyncReporter);
  }


  stopAsyncProfiler(callback) {
    let self = this;

    self.stopProfiler(self.asyncReporter, callback);
  }


  startAllocationProfiler() {
    let self = this;

    self.startProfiler(self.allocationReporter);
  }


  stopAllocationProfiler(callback) {
    let self = this;

    self.stopProfiler(self.allocationReporter, callback);
  }


  profile(name) {
    let self = this;

    if (!self.agentStarted || self.isProfiling) {
      return {
        stop: function(callback) {
          if (callback) {
            callback();
          }
          else {
            return Promise.resolve();
          }
        }
      };
    }

    self.isProfiling = true;

    let span = null;
    if(self.config.isAgentEnabled() && !self.config.isProfilingDisabled()) {
      let reporters = [];
      if (self.cpuReporter.started) {
        reporters.push(self.cpuReporter);
      }
      if (self.allocationReporter.started) {
        reporters.push(self.allocationReporter);
      }
      if (self.asyncReporter.started) {
        reporters.push(self.asyncReporter);
      }

      if(reporters.length > 0) {
        span = reporters[Math.floor(Math.random() * reporters.length)].profile(true, true);
      }
    }

    let timestamp = process.hrtime();

    return {
      stop: function() {
        if (span) {
          span.stop();
        }

        let duration = process.hrtime(timestamp);
        self.spanReporter.recordSpan(name || 'Default', duration[0] * 1e3 + duration[1] / 1e6);

        self.isProfiling = false;
      }
    };
  }


  report(callback) {
    let self = this;

    try {
      if (callback) {
        self._report(() => {
          callback();
        });
      }
      else {
        return new Promise((resolve, reject) => {
          self._report(() => {
            resolve();
          });
        });
      }
    }
    catch(err) {
      self.exception(err);
    }
  }


  _report(callback) {
    let self = this;

    if (self.getOption('autoProfiling')) {
      return callback();
    }

    self.cpuReporter.report(true);
    self.allocationReporter.report(true);
    self.asyncReporter.report(true);

    self.configLoader.load((err) => {
      if(err) {
        self.exception(err);
      }
      self.messageQueue.flush(true, (err) => {
        if(err) {
          self.exception(err);
        }

        callback();
      });
    });
  }


  matchVersion(min, max) {
    let versionRegexp = /v?(\d+)\.(\d+)\.(\d+)/;
    
    let m = versionRegexp.exec(process.version);
    let currN = 1e9 * parseInt(m[1]) + 1e6 * parseInt(m[2]) + 1e3 * parseInt(m[3]);

    let minN = 0;
    if (min) {
      m = versionRegexp.exec(min);
      minN = 1e9 * parseInt(m[1]) + 1e6 * parseInt(m[2]) + 1e3 * parseInt(m[3]);
    }

    let maxN = Infinity;
    if (max) {
      m = versionRegexp.exec(max);
      maxN = 1e9 * parseInt(m[1]) + 1e6 * parseInt(m[2]) + 1e3 * parseInt(m[3]);
    }

    return currN >= minN && currN <= maxN;
  }


  logPrefix() {
    let self = this;  

    function pad(num) {
      return (num < 10 ? '0' + num : '' + num);
    }

    let d = new Date();
    return `[${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${d.getMilliseconds()}] StackImpact ${self.version}:`;
  }


  log(message) {
    let self = this;  

    if (self.getOption('debug')) {
      console.log(self.logPrefix(), message);
    }
  }


  error(message) {
    let self = this;  

    if (self.getOption('debug')) {
      console.error(self.logPrefix(), message);
    }
  }


  exception(err) {
    let self = this;  

    if (self.getOption('debug')) {
      console.error(self.logPrefix(), err.message);
      console.error(self.logPrefix(), err.stack);
    }
  }


  setTimeout(func, t) {
    let self = this;  

    return setTimeout(() => {
      try {
        func.call(this);
      }
      catch (err) {
        self.exception(err);
      }
    }, t);
  }


  setInterval(func, t) {
    let self = this;  

    return setInterval(() => {
      try {
        func.call(this);
      }
      catch (err) {
        self.exception(err);
      }
    }, t);
  }
}

exports.Agent = Agent;

