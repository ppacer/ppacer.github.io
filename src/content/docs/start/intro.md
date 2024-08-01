---
title: Getting started with ppacer
---

## Intro

To begin, we'll set up new Go project, install ppacer, configure the ppacer
scheduler and executor within a single program, define new DAG that runs each
10 seconds, execute the program, and finally, explore the ppacer database.

:::note
The only prerequisite is having Go compiler in version `1.22` or higher.
:::


## Installing ppacer

```bash title="Setup Go project and install ppacer"
mkdir ppacer-demo && cd ppacer-demo
go mod init ppacerDemo
go get github.com/ppacer/core@latest
go get github.com/ppacer/tasks@latest
```


## Setting up scheduler and executor

Now, let's proceed to initiate the scheduler and executor within a single
program. Start by creating a file named `main.go` with the following content:

```go
// main.go
package main

import (
    "context"

    "github.com/ppacer/core"
    "github.com/ppacer/core/dag"
)

func main() {
    const port = 9321
    ctx := context.Background()
    dags := dag.Registry{} // no DAGs yet
    core.DefaultStarted(ctx, dags, port)
}
```

In the `main` function, we initialize a context, empty DAG registry and we
start both ppacer `Scheduler` and `Executor` with default configuration
(running in separate goroutines). Scheduler server would be started on the port
`9321`.

At this point, we have not defined any DAGs yet, but the program should compile
and execute:

```bash
go build
./ppacerDemo
```

Upon running, you should see messages similar to the following:

```bash
2024/03/11 23:19:57 INFO Start syncing DAG registry with dags and dagtasks tables
2024/03/11 23:19:57 INFO Finished syncing DAG registry with dags and dagtasks tables duration=237.875µs
```

The program will continue running indefinitely. You can terminate it for now.
Launching the program for the first time also sets up the two mentioned SQLite
databases for scheduler metadata and logs.


## Defining DAG

Now, let's create our first DAG. In ppacer DAGs are directed acyclic graphs
composed of [Tasks](https://pkg.go.dev/github.com/ppacer/core/dag#Task). In
this example we are going to use already implemented `PrintTask` task, to keep
it simple. To read about `Tasks`, please check [Tasks
chapter](/internals/dags#Tasks). We'll define a simple DAG with two tasks
`start` and `finish`, both of `PrintTask` type. You can place type definition
and function either in `main.go` file or any other `*.go` file within the same
directory.


```go
func printDAG(dagId string) dag.Dag {
    //         t21
    //       /
    // start
    //       \
    //         t22 --> finish
    start := dag.NewNode(tasks.NewPrintTask("start", "hello"))
    t21 := dag.NewNode(tasks.NewPrintTask("t21", "foo"))
    t22 := dag.NewNode(tasks.NewPrintTask("t22", "bar"))
    finish := dag.NewNode(tasks.NewPrintTask("finish", "I'm done!"))

    start.Next(t21)
    start.Next(t22)
    t22.Next(finish)

    startTs := time.Date(2024, time.March, 11, 12, 0, 0, 0, time.Local)
    schedule := schedule.NewFixed(startTs, 10*time.Second)

    printDag := dag.New(dag.Id(dagId)).
        AddSchedule(&schedule).
        AddRoot(start).
        Done()
    return printDag
}
```

We can now add this DAG to the `dag.Registry` in our `main` function, like
so:

```go {3-4}
func main() {
    const port = 9321
    dags := dag.Registry{}
    dags.Add(printDAG("printing_dag"))
    core.DefaultStarted(ctx, dags, port)
```

Just in case you don't have `goimports` setup in your environment, please make
sure you added new imports after we added new DAG implementation (`goimports`
does it automatically):

```go {3,7-8}
import (
	"context"
	"time"

	"github.com/ppacer/core"
	"github.com/ppacer/core/dag"
	"github.com/ppacer/core/dag/schedule"
	"github.com/ppacer/tasks"
)
```

Rebuild and rerun the program:

```bash
go build
./ppacerDemo
```

Every 10 seconds, you should see scheduler logs and our messages from
`PrintTask` on the console's standard output.


```bash
time=2024-08-01T12:56:00.190+02:00 level=INFO msg="Updating dag run task status" currentStatus=SCHEDULED newStatus=RUNNING
[start] hello
time=2024-08-01T12:56:00.193+02:00 level=INFO msg="Start upserting dag run task status" dagruntask="{DagId:printing_dag AtTime:2024-08-01 12:56:00 +0200 CEST TaskId:start Retry:0}" status=SUCCESS
```

You can observe the output for a while, then stop the program. This time,
databases should contain data.

:::note
If you want a less noisy stdout, you can increase the log severity level using
an environment variable:

```
PPACER_LOG_LEVEL=WARN ./ppacerDemo
```
:::


```
PPACER_LOG_LEVEL=WARN ./ppacerDemo                                                                                                                                                                                             [12:56:02]

[start] hello
[t21] foo
[t22] bar
[finish] I'm done!
[start] hello
[t22] bar
[t21] foo
[finish] I'm done!
```


## Exploring scheduler database

While a frontend for ppacer is not yet available, you can directly explore the
scheduler database.

:::note
This chapter will be replaced with exploring actual web-based UI, when it'll be
ready.
:::


### dags table

```bash
sqlite3 scheduler.db 'SELECT DagId, StartTs, Schedule, CreateTs FROM dags'
```

```
DagId         StartTs                       Schedule    CreateTs
------------  ----------------------------  ----------  ------------------------------------
printing_dag  2024-03-11T12:00:00CET+01:00  Fixed: 10s  2024-08-01T12:55:52.543502CEST+02:00
```

### dagruns table


```bash
sqlite3 scheduler.db 'SELECT * FROM dagruns'
```

```
RunId  DagId         ExecTs                         InsertTs                              Status   StatusUpdateTs                        Version
-----  ------------  -----------------------------  ------------------------------------  -------  ------------------------------------  -------
1      printing_dag  2024-08-01T13:01:50CEST+02:00  2024-08-01T13:01:50.041683CEST+02:00  SUCCESS  2024-08-01T13:01:50.104957CEST+02:00  0.0.1
2      printing_dag  2024-08-01T13:02:00CEST+02:00  2024-08-01T13:02:00.08308CEST+02:00   SUCCESS  2024-08-01T13:02:00.14549CEST+02:00   0.0.1
3      printing_dag  2024-08-01T13:02:10CEST+02:00  2024-08-01T13:02:10.023493CEST+02:00  SUCCESS  2024-08-01T13:02:10.045511CEST+02:00  0.0.1
4      printing_dag  2024-08-01T13:02:20CEST+02:00  2024-08-01T13:02:20.063723CEST+02:00  SUCCESS  2024-08-01T13:02:20.082941CEST+02:00  0.0.1
```

### dagruntasks table


```bash
sqlite3 scheduler.db 'SELECT * FROM dagruntasks'
```

```
DagId         ExecTs                         TaskId  Retry  InsertTs                              Status   StatusUpdateTs                        Version
------------  -----------------------------  ------  -----  ------------------------------------  -------  ------------------------------------  -------
printing_dag  2024-08-01T13:01:50CEST+02:00  start   0      2024-08-01T13:01:50.045841CEST+02:00  SUCCESS  2024-08-01T13:01:50.097404CEST+02:00  0.0.1
printing_dag  2024-08-01T13:01:50CEST+02:00  t22     0      2024-08-01T13:01:50.097706CEST+02:00  SUCCESS  2024-08-01T13:01:50.10056CEST+02:00   0.0.1
printing_dag  2024-08-01T13:01:50CEST+02:00  t21     0      2024-08-01T13:01:50.097805CEST+02:00  SUCCESS  2024-08-01T13:01:50.101237CEST+02:00  0.0.1
printing_dag  2024-08-01T13:01:50CEST+02:00  finish  0      2024-08-01T13:01:50.101479CEST+02:00  SUCCESS  2024-08-01T13:01:50.104372CEST+02:00  0.0.1
printing_dag  2024-08-01T13:02:00CEST+02:00  start   0      2024-08-01T13:02:00.086023CEST+02:00  SUCCESS  2024-08-01T13:02:00.13552CEST+02:00   0.0.1
printing_dag  2024-08-01T13:02:00CEST+02:00  t21     0      2024-08-01T13:02:00.136386CEST+02:00  SUCCESS  2024-08-01T13:02:00.140311CEST+02:00  0.0.1
printing_dag  2024-08-01T13:02:00CEST+02:00  t22     0      2024-08-01T13:02:00.136419CEST+02:00  SUCCESS  2024-08-01T13:02:00.14095CEST+02:00   0.0.1
printing_dag  2024-08-01T13:02:00CEST+02:00  finish  0      2024-08-01T13:02:00.142026CEST+02:00  SUCCESS  2024-08-01T13:02:00.144607CEST+02:00  0.0.1
printing_dag  2024-08-01T13:02:10CEST+02:00  start   0      2024-08-01T13:02:10.029685CEST+02:00  SUCCESS  2024-08-01T13:02:10.036071CEST+02:00  0.0.1
printing_dag  2024-08-01T13:02:10CEST+02:00  t22     0      2024-08-01T13:02:10.036625CEST+02:00  SUCCESS  2024-08-01T13:02:10.04077CEST+02:00   0.0.1
printing_dag  2024-08-01T13:02:10CEST+02:00  t21     0      2024-08-01T13:02:10.036776CEST+02:00  SUCCESS  2024-08-01T13:02:10.041748CEST+02:00  0.0.1
printing_dag  2024-08-01T13:02:10CEST+02:00  finish  0      2024-08-01T13:02:10.041928CEST+02:00  SUCCESS  2024-08-01T13:02:10.044946CEST+02:00  0.0.1
printing_dag  2024-08-01T13:02:20CEST+02:00  start   0      2024-08-01T13:02:20.066698CEST+02:00  SUCCESS  2024-08-01T13:02:20.072781CEST+02:00  0.0.1
printing_dag  2024-08-01T13:02:20CEST+02:00  t21     0      2024-08-01T13:02:20.073503CEST+02:00  SUCCESS  2024-08-01T13:02:20.078057CEST+02:00  0.0.1
printing_dag  2024-08-01T13:02:20CEST+02:00  t22     0      2024-08-01T13:02:20.073601CEST+02:00  SUCCESS  2024-08-01T13:02:20.07902CEST+02:00   0.0.1
printing_dag  2024-08-01T13:02:20CEST+02:00  finish  0      2024-08-01T13:02:20.079571CEST+02:00  SUCCESS  2024-08-01T13:02:20.082625CEST+02:00  0.0.1
```

## Complete example

The whole source code for above example can be found in here:
[github.com/ppacer/examples](https://github.com/ppacer/examples/tree/main/hello).


