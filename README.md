# StackImpact Node.js Profiler

## Overview

StackImpact is a production-grade performance profiler built for both production and development environments. It gives developers continuous and historical code-level view of application performance that is essential for locating CPU, memory allocation and I/O hot spots as well as latency bottlenecks. Included runtime metrics and error monitoring complement profiles for extensive performance analysis. Learn more at [stackimpact.com](https://stackimpact.com/).

![dashboard](https://stackimpact.com/img/readme/hotspots-cpu-1.5-nodejs.png)


#### Features

* Continuous hot spot profiling of CPU usage, memory allocation and async calls.
* Continuous latency bottleneck tracing.
* Error and exception monitoring.
* Health monitoring including CPU, memory, garbage collection and other runtime metrics.
* Alerts on profile anomalies.
* Team access.

Learn more on the [features](https://stackimpact.com/features/) page (with screenshots).


#### How it works

The StackImpact profiler agent is imported into a program and used as a normal package. When the program runs, various sampling profilers are started and stopped automatically by the agent and/or programmatically using the agent methods. The agent periodically reports recorded profiles and metrics to the StackImpact Dashboard. The agent can also operate in manual mode, which should be used in development only.


#### Documentation

See full [documentation](https://stackimpact.com/docs/) for reference.



## Supported environment

* Linux, OS X or Windows. Node.js v4.0.0 or higher.
* CPU profiler is disabled by default for Node.js v7.0.0 to v8.9.3 due to memory leak in underlying V8's CPU profiler. To enable, add `cpuProfilerDisabled: false` to startup options.
* Allocation profiler supports Node.js v6.0.0 and higher, but is disabled by default for Node.js v6.0.0 to v8.5.0 due to segfaults. To enable, add `allocationProfilerDisabled: false` to startup options.
* Async profiler supports Node.js v8.1.0 and higher.


## Getting started


#### Create StackImpact account

Sign up for a free trial account at [stackimpact.com](https://stackimpact.com) (also with GitHub login).


#### Installing the agent

Install the Node.js agent by running

```
npm install stackimpact
```

And import the package in your application

```javascript
const stackimpact = require('stackimpact');
```


#### Configuring the agent

Start the agent in the main thread by specifying the agent key and application name. The agent key can be found in your account's Configuration section.

```javascript
const agent = stackimpact.start({
  agentKey: 'agent key here',
  appName: 'MyNodejsApp'
});
```

All initialization options:

* `agentKey` (Required) The API key for communication with the StackImpact servers.
* `appName` (Required) A name to identify and group application data. Typically, a single codebase, deployable unit or executable module corresponds to one application.
* `appVersion` (Optional) Sets application version, which can be used to associate profiling information with the source code release.
* `appEnvironment` (Optional) Used to differentiate applications in different environments.
* `hostName` (Optional) By default, host name will be the OS hostname.
* `autoProfiling` (Optional) If set to `false`, disables automatic profiling and reporting. Focused or manual profiling should be used instead. Useful for environments without support for timers or background tasks.
* `debug` (Optional) Enables debug logging.
* `cpuProfilerDisabled`, `allocationProfilerDisabled`, `asyncProfilerDisabled`, `errorProfilerDisabled` (Optional) Disables respective profiler when `true`.
* `includeAgentFrames` (Optional) Set to `true` to not exclude agent stack frames from profiles.


#### Focused profiling

Use `agent.profile(name)` to instruct the agent when to start and stop profiling. The agent decides if and which profiler is activated. Normally, this method should be used in repeating code, such as request or event handlers. In addition to more precise profiling, timing information will also be reported for the profiled spans. Usage example:

```javascript
const span = agent.profile('span1');

// your code here

span.stop();
```

Is no callback is provided, `stop()` method returns a promise.


#### Manual profiling

*Manual profiling should not be used in production!*

By default, the agent starts and stops profiling automatically. Manual profiling allows to start and stop profilers directly. It is suitable for profiling short-lived programs and should not be used for long-running production applications. Automatic profiling should be disabled with `autoProfiling: false`.

```javascript
// Start CPU profiler.
agent.startCpuProfiler();
```

```javascript
// Stop CPU profiler and report the recorded profile to the Dashboard.
agent.stopCpuProfiler(callback);
```

```javascript
// Start async call profiler.
agent.startAsyncProfiler();
```

```javascript
// Stop async call profiler and report the recorded profile to the Dashboard.
agent.stopAsyncProfiler(callback);
```

```javascript
// Start heap allocation profiler.
agent.startAllocationProfiler();
```

```javascript
// Stop heap allocation profiler and report the recorded profile to the Dashboard.
agent.stopAllocationProfiler(callback);
```


#### Shutting down the agent
*Optional*

Use `agent.destroy()` to stop the agent if necessary, e.g. to allow application to exit.


#### Analyzing performance data in the Dashboard

Once your application is restarted, you can start observing continuous CPU, memory, I/O, and other hot spot profiles, execution bottlenecks as well as process metrics in the [Dashboard](https://dashboard.stackimpact.com/).


#### Troubleshooting

To enable debug logging, add `debug: true` to startup options. If the debug log doesn't give you any hints on how to fix a problem, please report it to our support team in your account's Support section.


## Overhead

The agent overhead is measured to be less than 1% for applications under high load.
