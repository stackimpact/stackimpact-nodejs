#ifndef ADDON_CPU_PROFILER_H_
#define ADDON_CPU_PROFILER_H_

#include <nan.h>

namespace cpu_profiler {

  NAN_METHOD(StartCPUProfiler);

  NAN_METHOD(StopCPUProfiler);

}

#endif  // ADDON_CPU_PROFILER_H_