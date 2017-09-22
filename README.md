# StackImpact Node.js Agent

## Overview

StackImpact is a performance profiler for production applications. It gives developers continuous and historical view of application performance with line-of-code precision, which includes CPU, memory allocation and blocking call hot spots as well as execution bottlenecks, errors and runtime metrics. Learn more at [stackimpact.com](https://stackimpact.com/).

![dashboard](https://stackimpact.com/wp-content/uploads/2017/09/hotspots-cpu-1.4-nodejs.png)


#### Features

* Continuous hot spot profiling for CPU, memory allocations, blocking calls
* Continuous bottleneck tracing for HTTP handlers and other libraries
* Exception monitoring
* Health monitoring including CPU, memory, garbage collection and other runtime metrics
* Anomaly alerts on most important metrics
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
let agent = stackimpact.start({
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
* `debug` (Optional) Enables debug logging.
* `cpuProfilerDisabled`, `allocationProfilerDisabled`, `asyncProfilerDisabled`, `errorProfilerDisabled` (Optional) Disables respective profiler when `true`.
* `includeAgentFrames` (Optional) Set to `true` to not exclude agent stack frames from profiles.


#### Shutting down the agent

Use `agent.destroy()` to stop the agent if necessary, e.g. to allow application to exit.


#### Analyzing performance data in the Dashboard

Once your application is restarted, you can start observing continuous CPU, memory, I/O, and other hot spot profiles, execution bottlenecks as well as process metrics in the [Dashboard](https://dashboard.stackimpact.com/).


#### Troubleshooting

To enable debug logging, add `debug: true` to startup options. If the debug log doesn't give you any hints on how to fix a problem, please report it to our support team in your account's Support section.


## Overhead

The agent overhead is measured to be less than 1% for applications under high load.
