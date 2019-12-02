#include <nan.h>
#include <uv.h>
#include "v8.h"


namespace event_loop_stats {

  uv_check_t check_handle;
  uv_prepare_t prepare_handle;

  bool is_started = false;

  uint64_t num_ticks;
  uint64_t io_time;

  uint64_t io_start;


  static void PrepareCallback(uv_prepare_t* handle) {
    if (!is_started) {
      return;
    }

    io_start = uv_hrtime();
  }


  static void CheckCallback(uv_check_t* handle) {
    if (!is_started) {
      return;
    }

    num_ticks++;

    if (io_start > 0) {
      io_time += uv_hrtime() - io_start;
    }
  }


  NAN_METHOD(StartEventLoopStats) {
    if (is_started) {
      return;
    }

    uv_prepare_init(uv_default_loop(), &prepare_handle);
    uv_prepare_start(&prepare_handle, reinterpret_cast<uv_prepare_cb>(CheckCallback));
    uv_unref(reinterpret_cast<uv_handle_t*>(&prepare_handle));

    uv_check_init(uv_default_loop(), &check_handle);
    uv_check_start(&check_handle, reinterpret_cast<uv_check_cb>(PrepareCallback));
    uv_unref(reinterpret_cast<uv_handle_t*>(&check_handle));

    num_ticks = 0;
    io_time = 0;

    io_start = 0;

    is_started = true;
  }


  NAN_METHOD(StopEventLoopStats) {
    if (!is_started) {
      return;
    }

    is_started = false;

    uv_check_stop(&check_handle);

    uv_prepare_stop(&prepare_handle);
  }


  NAN_METHOD(ReadAndResetEventLoopStats) {
    v8::Local<v8::Object> stats = Nan::New<v8::Object>();
    Nan::Set(stats, Nan::New<v8::String>("num_ticks").ToLocalChecked(), Nan::New<v8::Number>(num_ticks));
    Nan::Set(stats, Nan::New<v8::String>("io_time").ToLocalChecked(), Nan::New<v8::Number>(io_time));

    num_ticks = 0;
    io_time = 0;

    info.GetReturnValue().Set(stats);
  }

}
