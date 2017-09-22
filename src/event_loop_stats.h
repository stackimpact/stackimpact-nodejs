#ifndef ADDON_EVENT_LOOP_STATS_H_
#define ADDON_EVENT_LOOP_STATS_H_

#include <nan.h>

namespace event_loop_stats {

  NAN_METHOD(StartEventLoopStats);

  NAN_METHOD(StopEventLoopStats);

  NAN_METHOD(ReadAndResetEventLoopStats);

}

#endif  // ADDON_EVENT_LOOP_STATS_H_