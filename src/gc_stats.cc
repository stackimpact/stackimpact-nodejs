#include <nan.h>
#include <uv.h>
#include "v8.h"


namespace gc_stats {

  bool is_started = false;

  uint64_t num_cycles;
  uint64_t cycle_start;
  uint64_t total_time;


  //void GCPrologCallback(v8::Isolate *isolate, v8::GCType type, v8::GCCallbackFlags flags) {
  static NAN_GC_CALLBACK(GCPrologCallback) {
    if (!is_started) {
      return;
    }

    cycle_start = uv_hrtime();
    num_cycles++;
  }


  static NAN_GC_CALLBACK(GCEpilogCallback) {
  //void GCEpilogCallback(v8::Isolate *isolate, v8::GCType type, v8::GCCallbackFlags flags) {
    if (!is_started) {
      return;
    }

    total_time += uv_hrtime() - cycle_start;
  }


  NAN_METHOD(StartGCStats) {
    if (is_started) {
      return;
    }

    v8::Isolate* isolate = info.GetIsolate();

    isolate->AddGCPrologueCallback(GCPrologCallback);
    isolate->AddGCEpilogueCallback(GCEpilogCallback);

    num_cycles = 0;
    total_time = 0;

    is_started = true;
  }


  NAN_METHOD(StopGCStats) {
    if (!is_started) {
      return;
    }

    is_started = false;

    v8::Isolate* isolate = info.GetIsolate();

    isolate->RemoveGCPrologueCallback(GCPrologCallback);
    isolate->RemoveGCEpilogueCallback(GCEpilogCallback);
  }


  NAN_METHOD(ReadAndResetGCStats) {
    v8::Local<v8::Object> stats = Nan::New<v8::Object>();
    Nan::Set(stats, Nan::New<v8::String>("num_cycles").ToLocalChecked(), Nan::New<v8::Number>(num_cycles));
    Nan::Set(stats, Nan::New<v8::String>("total_time").ToLocalChecked(), Nan::New<v8::Number>(total_time));

    num_cycles = 0;
    total_time = 0;

    info.GetReturnValue().Set(stats);
  }

}
