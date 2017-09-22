{
  "targets": [
    {
      "target_name": "stackimpact-addon",
      "sources": [
        "src/stackimpact_addon.cc",
        "src/heap_stats.cc",
        "src/gc_stats.cc",
        "src/event_loop_stats.cc",
        "src/cpu_profiler.cc",
        "src/allocation_sampler.cc"
      ],
      "include_dirs": ["<!(node -e \"require('nan')\")"]
    }
  ]
}
