#include <nan.h>
#include "heap_stats.h"
#include "gc_stats.h"
#include "event_loop_stats.h"
#include "cpu_profiler.h"
#include "allocation_sampler.h"


NAN_MODULE_INIT(InitAll) {
  Nan::Set(target, 
    Nan::New<v8::String>("readHeapStats").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(heap_stats::ReadHeapStats)).ToLocalChecked());

  Nan::Set(target, 
    Nan::New<v8::String>("startGCStats").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(gc_stats::StartGCStats)).ToLocalChecked());

  Nan::Set(target, 
    Nan::New<v8::String>("stopGCStats").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(gc_stats::StopGCStats)).ToLocalChecked());

  Nan::Set(target, 
    Nan::New<v8::String>("readAndResetGCStats").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(gc_stats::ReadAndResetGCStats)).ToLocalChecked());

  Nan::Set(target, 
    Nan::New<v8::String>("startEventLoopStats").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(event_loop_stats::StartEventLoopStats)).ToLocalChecked());

  Nan::Set(target, 
    Nan::New<v8::String>("stopEventLoopStats").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(event_loop_stats::StopEventLoopStats)).ToLocalChecked());

  Nan::Set(target, 
    Nan::New<v8::String>("readAndResetEventLoopStats").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(event_loop_stats::ReadAndResetEventLoopStats)).ToLocalChecked());

  Nan::Set(target, 
    Nan::New<v8::String>("startCpuProfiler").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(cpu_profiler::StartCPUProfiler)).ToLocalChecked());

  Nan::Set(target, 
    Nan::New<v8::String>("stopCpuProfiler").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(cpu_profiler::StopCPUProfiler)).ToLocalChecked());

  Nan::Set(target, 
    Nan::New<v8::String>("checkAllocationSampler").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(allocation_sampler::CheckAllocationSampler)).ToLocalChecked());

#if V8_MAJOR_VERSION >= 5
  Nan::Set(target, 
    Nan::New<v8::String>("startAllocationSampler").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(allocation_sampler::StartAllocationSampler)).ToLocalChecked());

  Nan::Set(target, 
    Nan::New<v8::String>("stopAllocationSampler").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(allocation_sampler::StopAllocationSampler)).ToLocalChecked());

  Nan::Set(target, 
    Nan::New<v8::String>("readAllocationProfile").ToLocalChecked(),
    Nan::GetFunction(Nan::New<v8::FunctionTemplate>(allocation_sampler::ReadAllocationProfile)).ToLocalChecked());
#endif

}

NODE_MODULE(addon, InitAll)

