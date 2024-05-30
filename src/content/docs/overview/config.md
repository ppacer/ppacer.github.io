---
title: Configuration
---

At the current stage of ppacer configuration is defined as regular Go
structures. There is no additional layer to parse configuration file(s) into
those structures. Also there is no single global place for configuration,
rather each top-level ppacer object which can be configurable would accept
appropriate configuration type in its constructor.

Usually for each configuration Go structure there is corresponding instance of
that type defining default configuration. For example:

```go
// Configuration for DagRunWatcher which is responsible for scheduling new DAG
// runs based on their schedule.
type DagRunWatcherConfig struct {
    // DagRunWatcher waits WatchInterval before another try of scheduling DAG
    // runs.
    WatchInterval time.Duration

    // DagRunWatcher would wait for QueueIsFullInterval in case when DAG run
    // queue is full, before it would try again.
    QueueIsFullInterval time.Duration

    // Duration for database context timeout for queries done by DagRunWatcher.
    DatabaseContextTimeout time.Duration
}

// Default DagRunWatcher configuration.
var DefaultDagRunWatcherConfig DagRunWatcherConfig = DagRunWatcherConfig{
    WatchInterval:          100 * time.Millisecond,
    QueueIsFullInterval:    100 * time.Millisecond,
    DatabaseContextTimeout: 10 * time.Second,
}
```

This convention is used in ppacer consistently everywhere where there are
configuration objects.


## Scheduler configuration

In the [ppacer hello world](/start/intro) example we can see that default
scheduler is initialized using
[scheduler.DefaultStarted](https://pkg.go.dev/github.com/ppacer/core/scheduler#DefaultStarted)
function which helps us create ppacer scheduler using the default
configuration.

Let's assume, for a moment, that we want to initialize non default ppacer
scheduler. To do it, we should use
[scheduler.New](https://pkg.go.dev/github.com/ppacer/core/scheduler#New)
constructor. That function needs, among other parameters, scheduler
configuration object.

* That object is [scheduler.Config](https://pkg.go.dev/github.com/ppacer/core/scheduler#Config)
    with default values defined under
    [scheduler.DefaultConfig](https://pkg.go.dev/github.com/ppacer/core/scheduler#DefaultConfig).
    It contains also other configuration objects for lower level objects:

    * [scheduler.TaskSchedulerConfig](https://pkg.go.dev/github.com/ppacer/core/scheduler#TaskSchedulerConfig)
        for `TaskScheduler` configuration
    * [scheduler.DagRunWatcherConfig](https://pkg.go.dev/github.com/ppacer/core/scheduler#DagRunWatcherConfig)
        for `DagRunWatcher`.


## Executor configuration

Configuration for ppacer executors is much simpler, then for the scheduler.
It's defined by
[exec.Config](https://pkg.go.dev/github.com/ppacer/core/exec#Config) type.


## Details and default values

For getting detailed information on configuration objects, their meaning and
default values, please follow the links above to Go package API references.

