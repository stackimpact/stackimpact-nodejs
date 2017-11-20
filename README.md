# StackImpact Node.js Agent

## Overview

StackImpact is a performance profiler for production applications. It gives developers continuous and historical view of application performance with line-of-code precision, which includes CPU, memory allocation and async call hot spots as well as execution bottlenecks, errors and runtime metrics. Learn more at [stackimpact.com](https://stackimpact.com/).

![dashboard](https://stackimpact.com/wp-content/uploads/2017/09/hotspots-cpu-1.4-nodejs.png)


#### Features

* Continuous hot spot profiling for CPU, memory allocations, async calls
* Continuous latency bottleneck tracing
* Exception monitoring
* Health monitoring including CPU, memory, garbage collection and other runtime metrics
* Anomaly detection
* Multiple account users for team collaboration

Learn more on the [features](https://stackimpact.com/features/) page (with screenshots).


#### Documentation

See full [documentation](https://stackimpact.com/docs/) for reference.



## Supported environment

* Linux, OS X or Windows. Node.js v4.0.0 or higher.
* **CPU profiler is disabled by default for Node.js v7.0.0 and higher due to memory leak in underlying V8’s CPU profiler. To enable, add `cpuProfilerDisabled: false` to startup options.**
* Allocation profiler supports Node.js v6.0.0 and higher. **The allocation profiler is disabled by default, since V8’s heap sampling is still experimental and is seen to result in segmentation faults. To enable, add `allocationProfilerDisabled: false` to startup options.**
* Async profiler supports Node.js v8.1.0 and higher.


## Getting started


#### Create StackImpact account

[Sign up](https://dashboard.stackimpact.com/#/signup) for a free account (also with GitHub login).


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
* `autoProfiling` (Optional) If set to `false`, disables automatic profiling and reporting. `agent.profile()` and `agent.report(callback)` should be used instead. Useful for environments without support for timers or background tasks.
* `debug` (Optional) Enables debug logging.
* `cpuProfilerDisabled`, `allocationProfilerDisabled`, `asyncProfilerDisabled`, `errorProfilerDisabled` (Optional) Disables respective profiler when `true`.
* `includeAgentFrames` (Optional) Set to `true` to not exclude agent stack frames from profiles.


#### Manual profiling
*Optional*

Use `agent.profile()` to instruct the agent when to start and stop profiling. The agent decides if and which profiler is activated. Normally, this method should be used in repeating code, such as request or event handlers. If `autoProfiling` is disabled, this method will also periodically report the profiling data to the Dashboard. Usage example:

```javascript
const span = agent.profile();

// your code here

span.stop();
```

Is no callback is provided, `stop()` method returns a promise.


#### Shutting down the agent
*Optional*

Use `agent.destroy()` to stop the agent if necessary, e.g. to allow application to exit.


#### Analyzing performance data in the Dashboard

Once your application is restarted, you can start observing continuous CPU, memory, I/O, and other hot spot profiles, execution bottlenecks as well as process metrics in the [Dashboard](https://dashboard.stackimpact.com/).


#### Troubleshooting

To enable debug logging, add `debug: true` to startup options. If the debug log doesn't give you any hints on how to fix a problem, please report it to our support team in your account's Support section.


## Overhead

The agent overhead is measured to be less than 1% for applications under high load. For applications that are horizontally scaled to multiple processes, StackImpact agents are only active on a small subset (adjustable) of the processes at any point of time, therefore the total overhead is much lower.
