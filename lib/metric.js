'use strict';


const metricConstants = {
  TYPE_STATE: 'state',
  TYPE_COUNTER: 'counter',
  TYPE_PROFILE: 'profile',
  TYPE_TRACE: 'trace',
  CATEGORY_CPU: 'cpu',
  CATEGORY_MEMORY: 'memory',
  CATEGORY_GC: 'gc',
  CATEGORY_RUNTIME: 'runtime',
  CATEGORY_SPAN: 'span',
  CATEGORY_CPU_PROFILE: 'cpu-profile',
  CATEGORY_MEMORY_PROFILE: 'memory-profile',
  CATEGORY_ASYNC_PROFILE: 'async-profile',
  CATEGORY_ASYNC_TRACE: 'async-trace',
  CATEGORY_ERROR_PROFILE: 'error-profile',
  NAME_CPU_TIME: 'CPU time',
  NAME_CPU_USAGE: 'CPU usage',
  NAME_RSS: 'RSS',
  NAME_USED_HEAP_SIZE: 'Used heap size',
  NAME_TOTAL_HEAP_SIZE: 'Total heap size',
  NAME_CPP_OBJECTS: 'C++ Objects',
  NAME_GC_CYCLES: 'GC cycles',
  NAME_GC_TIME: 'GC time',
  NAME_EVENT_LOOP_TICKS: 'Event loop ticks',
  NAME_EVENT_LOOP_IO_STAGE: 'Event loop I/O stage',
  NAME_HEAP_ALLOCATION_RATE: 'Heap allocation rate',
  NAME_ASYNC_CALL_TIMES: 'Async call times',
  NAME_UNCAUGHT_EXCEPTIONS: 'Uncaught exceptions',
  NAME_UNHANDLED_REJECTIONS: 'Unhandled rejections',
  UNIT_NONE: '',
  UNIT_MILLISECOND: 'millisecond',
  UNIT_MICROSECOND: 'microsecond',
  UNIT_NANOSECOND: 'nanosecond',
  UNIT_BYTE: 'byte',
  UNIT_KILOBYTE: 'kilobyte',
  UNIT_PERCENT: 'percent',
  TRIGGER_TIMER: 'timer',
  TRIGGER_API: 'api'
};


class Metric {
  constructor(agent, typ, category, name, unit) {
    let self = this;

    self.agent = agent;
    self.id = agent.utils.generateSha1(`${agent.getOption('appName')}${agent.getOption('appEnvironment')}${agent.getOption('hostName')}${typ}${name}${category}${unit}`);
    self.type = typ;
    self.category = category;
    self.name = name;
    self.unit = unit;
    self.measurement = null;
    self.hasLastValue = false;
    self.lastValue = null;
  }


  static get c() {
    return metricConstants;
  }


  hasMeasurement() {
    let self = this;

    return !!self.measurement;
  }


  createMeasurement(trigger, value, duration, breakdown) {
    let self = this;

    let ready = true;

    if (self.type === Metric.c.TYPE_COUNTER) {
      if (!self.hasLastValue) {
        ready = false;
        self.hasLastValue = true;
        self.lastValue = value;
      }
      else {
        let tmpValue = value;
        value = value - self.lastValue;
        self.lastValue = tmpValue;
      }
    }

    if (ready) {
      self.measurement = new Measurement(
        self.agent,
        self.agent.utils.generateUuid(),
        trigger,
        value,
        duration,
        breakdown,
        self.agent.utils.timestamp());
    }
  }


  toJson() {
    let self = this;

    let measurementJson;
    if (self.measurement) {
      measurementJson = self.measurement.toJson();
    }

    let metricJson = {
      id: self.id,
      type: self.type,
      category: self.category,
      name: self.name,
      unit: self.unit,
      measurement: measurementJson
    };

    return metricJson;
  }
}

exports.Metric = Metric;


class Measurement {

  constructor(agent, id, trigger, value, duration, breakdown, timestamp) {
    let self = this;

    self.agent = agent;
    self.id = id;
    self.trigger = trigger;
    self.value = value;
    self.duration = duration;
    self.breakdown = breakdown;
    self.timestamp = timestamp;
  }


  toJson() {
    let self = this;

    let breakdownJson;
    if (self.breakdown) {
      breakdownJson = self.breakdown.toJson();
    }

    let measurementJson = {
      id: self.id,
      trigger: self.trigger,
      value: self.value,
      duration: self.duration,
      breakdown: breakdownJson,
      timestamp: self.timestamp
    };

    return measurementJson;
  }
}

exports.Measurement = Measurement;



const breakdownConstants = {
  TYPE_CALLGRAPH: 'callgraph',
  TYPE_DEVICE: 'device',
  TYPE_CALLSITE: 'callsite',
  TYPE_OPERATION: 'operation',
  TYPE_ERROR: 'error'
};


const RESERVOIR_SIZE = 1000;


class Breakdown {

  constructor(agent, name, typ) {
    let self = this;

    self.agent = agent;
    self.name = name;
    self.type = typ;
    self.metadata = new Map();
    self.measurement = 0;
    self.numSamples = 0;
    self.reservoir = null;
    self.children = new Map();
    self._overhead = 0;
  }


  static get c() {
    return breakdownConstants;
  }


  toJson() {
    let self = this;

    let metadataJson = {};
    for (let key of self.metadata.keys()) {
      metadataJson[key] = self.metadata.get(key);
    }

    let childrenJson = [];
    for (let child of self.children.values()) {
      childrenJson.push(child.toJson());
    }

    let breakdownJson = {
      name: self.name,
      type: self.type,
      metadata: metadataJson,
      measurement: self.measurement,
      num_samples: self.numSamples,
      children: childrenJson
    };

    return breakdownJson;
  }


  setType(typ) {
    let self = this;

    self.type = typ;
  }


  addMetadata(key, value) {
    let self = this;

    self.metadata.set(key, value);
  }


  getMetadata(key) {
    let self = this;

    return self.metadata.get(key);
  }


  findChild(name) {
    let self = this;

    return self.children.get(name);
  }


  addChild(child) {
    let self = this;

    self.children.set(child.name, child);
  }


  removeChild(child) {
    let self = this;

    self.children.delete(child.name);
  }


  findOrAddChild(name) {
    let self = this;

    let child = self.findChild(name);
    if (!child) {
      child = new Breakdown(self.agent, name);
      self.addChild(child);
    }

    return child;
  }


  increment(value, count) {
    let self = this;

    self.measurement += value;
    self.numSamples += count;
  }


  filter(fromLevel, min, max) {
    let self = this;

    self.filterLevel(1, fromLevel, min, max);
  }


  filterLevel(currentLevel, fromLevel, min, max) {
    let self = this;

    for (let name of self.children.keys()) {
      let child = self.children.get(name);
      if (currentLevel >= fromLevel && (child.measurement < min || child.measurement > max)) {
        self.children.delete(name);
      }
      else {
        child.filterLevel(currentLevel + 1, fromLevel, min, max);
      }
    }
  }


  depth() {
    let self = this;

    let max = 0;

    for (let child of self.children.values()) {
      let d = child.depth();
      if (d > max) {
        max = d;
      }
    }

    return max + 1;
  }


  floor() {
    let self = this;

    self.measurement = Math.floor(self.measurement);

    for (let child of self.children.values()) {
      child.floor();
    }
  }


  round() {
    let self = this;

    self.measurement = Math.round(self.measurement);

    for (let child of self.children.values()) {
      child.round();
    }
  }


  propagate() {
    let self = this;

    for (let child of self.children.values()) {
      child.propagate();
      
      self.measurement += child.measurement;
      self.numSamples += child.numSamples;
    }
  }


  evaluatePercent(totalSamples) {
    let self = this;

    self.measurement = (self.numSamples / totalSamples) * 100;

    for (let child of self.children.values()) {
      child.evaluatePercent(totalSamples);
    }
  }


  convertToPercent(total) {
    let self = this;

    self.measurement = (self.measurement / total) * 100;

    for (let child of self.children.values()) {
      child.convertToPercent(total);
    }
  }


  normalize(factor) {
    let self = this;

    self.measurement = self.measurement / factor;
    self.numSamples = Math.round(Math.ceil(self.numSamples / factor));

    for (let child of self.children.values()) {
      child.normalize(factor);
    }
  }


  updateP95(value) {
    let self = this;

    if (!self.reservoir) {
      self.reservoir = [];
    }

    if (self.reservoir.length < RESERVOIR_SIZE) {
      self.reservoir.push(value);
    }
    else {
      let index = Math.floor(Math.random() * RESERVOIR_SIZE);
      self.reservoir[index] = value;
    }

    self.numSamples += 1;
  }


  evaluateP95() {
    let self = this;

    if (self.reservoir && self.reservoir.length > 0) {
      self.reservoir.sort();
      let index = Math.floor(self.reservoir.length * 0.95);
      self.measurement = self.reservoir[index];
      self.reservoir = null;
    }

    for (let child of self.children.values()) {
      child.evaluateP95();
    }
  }


  dump(level) {
    let self = this;

    return self.dumpLevel(0);
  }


  dumpLevel(level) {
    let self = this;

    let s = '';

    for (let i = 0; i < level; i++) {
      s += ' ';
    }

    s += `${self.name} - ${self.measurement} (${self.numSamples})\n`;
    for (let child of self.children.values()) {
      s += child.dumpLevel(level + 1);
    }

    return s;
  }
}

exports.Breakdown = Breakdown;
