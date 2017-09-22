#ifndef ADDON_GC_STATS_H_
#define ADDON_GC_STATS_H_

#include <nan.h>

namespace gc_stats {

  NAN_METHOD(StartGCStats);

  NAN_METHOD(StopGCStats);

  NAN_METHOD(ReadAndResetGCStats);
}

#endif  // ADDON_GC_STATS_H_