---
title: High-level design
---

This chapter aims to provide high-level overview on how ppacer works.


## Top level

Starting from the top, we can say that ppacer is a set of Go packages that can
be used to define and compile a program(s) for scheduling and executing
directed acyclic graphs of tasks. These programs are compiled into
cross-platform and statically-linked binaries with no dependencies, like most
Go programs. Tasks are defined via regular Go code, meaning the processes
defined within ppacer are embedded into the program and are not parsed
dynamically at runtime.

Ppacer scheduler uses a database to persist information on processes, their
schedules, tasks, runs and other metadata. By default SQLite is used, but
ppacer can support any other database that provides a driver for standard
`database/sql` package. For details please check [Databases](/internals/dbs).



## Scheduler - the Heart of ppacer

The main objective of using ppacer is to setup and run a scheduler. To have a
running ppacer
[Scheduler](https://pkg.go.dev/github.com/ppacer/core/scheduler#Scheduler) we
need to initialize it and start it. `Scheduler` on the startup does the
following steps:

1. Synchronize
   [dag.Registry](https://pkg.go.dev/github.com/ppacer/core/dag#Registry), DAG
   runs and task queues with the database.
1. Setup and start
   [DagRunWatcher](https://pkg.go.dev/github.com/ppacer/core/scheduler#DagRunWatcher)
   in a separate goroutine, to detect new DAG runs.
1. Setup and start
   [TaskScheduler](https://pkg.go.dev/github.com/ppacer/core/scheduler#TaskScheduler),
   in a separate goroutine, to coordinate tasks scheduling for active DAG runs.
1. Register HTTP endpoints and finally return `*http.ServerMux`.

In other words we can say that ppacer `Scheduler` performs some housekeeping on
the startup and eventually exposes its API in form of HTTP server. In
particular tasks scheduled to be executed are stored in `Scheduler` internal
queue which can be accessed through one of the mentioned endpoints.


## Executor

[Executor](https://pkg.go.dev/github.com/ppacer/core/exec#Executor) executes
tasks. It has information about the same `dag.Registry` as `Scheduler`. When
`Executor` is initialized and running, it starts a never-ending loop, to ask
ppacer `Scheduler`, via HTTP, about new tasks to be executed. Tasks are
executed in separate goroutines. `Executor` also let `Scheduler` know about
executed task status - it doesn't have access to the main ppacer database.

`Scheduler` and `Executor` can be used in the same program - in this case
`Executor` just needs to be started in a separate Goroutine, as in [ppacer
hello world](/start/intro) example. Because of facts that `Executor`
communicates with `Scheduler` via HTTP and has information about
`dag.Registry` of processes we can have defined `Executor` in a separate binary
or even in multiple binaries placed on different computers or k8s nodes.

