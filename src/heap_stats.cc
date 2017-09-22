#include <nan.h>
#include "v8.h"


namespace heap_stats {

  NAN_METHOD(ReadHeapStats) {
    v8::Isolate* isolate = info.GetIsolate();

    v8::Local<v8::Object> stats = Nan::New<v8::Object>();
    v8::Local<v8::Array> spaces = Nan::New<v8::Array>();
    stats->Set(v8::String::NewFromUtf8(isolate, "spaces"), spaces);

    v8::HeapStatistics heap_stats;
    isolate->GetHeapStatistics(&heap_stats);

    stats->Set(Nan::New<v8::String>("used_heap_size").ToLocalChecked(), Nan::New<v8::Number>(heap_stats.used_heap_size()));

    for (size_t i = 0; i < isolate->NumberOfHeapSpaces(); ++i) {
      v8::HeapSpaceStatistics space_stats;
      isolate->GetHeapSpaceStatistics(&space_stats, i);

      v8::Local<v8::Object> space = Nan::New<v8::Object>();
      Nan::Set(space, Nan::New<v8::String>("space_name").ToLocalChecked(), Nan::New<v8::String>(space_stats.space_name()).ToLocalChecked());
      Nan::Set(space, Nan::New<v8::String>("space_size").ToLocalChecked(), Nan::New<v8::Number>(space_stats.space_size()));
      Nan::Set(space, Nan::New<v8::String>("space_used_size").ToLocalChecked(), Nan::New<v8::Number>(space_stats.space_used_size()));
      Nan::Set(space, Nan::New<v8::String>("space_available_size").ToLocalChecked(), Nan::New<v8::Number>(space_stats.space_available_size()));
      Nan::Set(space, Nan::New<v8::String>("physical_space_size").ToLocalChecked(), Nan::New<v8::Number>(space_stats.physical_space_size()));

      Nan::Set(spaces, i, space);
    }

    info.GetReturnValue().Set(stats);
  }

}
