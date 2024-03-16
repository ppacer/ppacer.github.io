---
title: Getting started with ppacer
---

## Intro

To begin, we'll set up  new Go project, install ppacer, configure the ppacer
scheduler and executor within a single program, define new DAG that runs each
10 seconds, execute the program, and finally, explore the ppacer database.

:::note
The only prerequisite is having Go compiler in version `1.22` or higher.
:::


## Installing ppacer

```bash title="Setup Go project and install ppacer"
mkdir ppacer-demo && cd ppacer-demo
go mod init ppacer_demo
go get github.com/ppacer/core@latest
go get github.com/ppacer/core/...
```


## Setting up scheduler and executor

Now, let's proceed to initiate the scheduler and executor within a single
program. Start by creating a file named `main.go` with the following content:

```go
// main.go
package main

import (
    "embed"
    "fmt"
    "log"
    "log/slog"
    "net/http"
    "time"

    "github.com/ppacer/core/dag"
    "github.com/ppacer/core/db"
    "github.com/ppacer/core/exec"
    "github.com/ppacer/core/meta"
    "github.com/ppacer/core/scheduler"
)

//go:embed *.go
var taskGoFiles embed.FS

func main() {
    const port = 9321
    meta.ParseASTs(taskGoFiles)
    dags := dag.Registry{} // no DAGs yet

    // Setup default scheduler
    schedulerServer := scheduler.DefaultStarted(dags, "scheduler.db", port)

    // Setup and run executor in a separate goroutine
    go func() {
        schedUrl := fmt.Sprintf("http://localhost:%d", port)
        logsDbClient, logsDbErr := db.NewSqliteClientForLogs("logs.db", nil)
        if logsDbErr != nil {
            log.Panic(logsDbErr)
        }
        executor := exec.New(schedUrl, logsDbClient, nil, nil)
        executor.Start(dags)
    }()

    // Start scheduler HTTP server
    lasErr := schedulerServer.ListenAndServe()
    if lasErr != nil {
        slog.Error("ListenAndServer failed", "err", lasErr)
        log.Panic("Cannot start the server")
    }
}
```

In the `main` function, we parse Go files' ASTs (to retrive the Task source
code, more on this later), initialize default `Scheduler`, setup and start an
executor in a separate goroutine, and finally, launch the scheduler's HTTP
server to enable communication between executor(s), clients, users and the
scheduler.

At this point, we have not defined any DAGs yet, but the program should compile
and execute:

```bash
go generate
go build
./ppacer_demo
```

Upon running, you should see messages similar to the following:

```bash
2024/03/11 23:19:57 INFO Start syncing DAG registry with dags and dagtasks tables
2024/03/11 23:19:57 INFO Finished syncing DAG registry with dags and dagtasks tables duration=237.875µs
```

The program will continue running indefinitely. You can terminate it for now.
Launching the program for the first time also sets up the two mentioned SQLite
databases for scheduler metadata and logs.


## Defining Task and DAG

Now, let's create our first DAG. In ppacer DAGs are directed acyclic graphs
composed of [Tasks](https://pkg.go.dev/github.com/ppacer/core/dag#Task). Let's
start by defining a Task:


```go
type printTask struct {
    taskId string
}

func (pt printTask) Id() string { return pt.taskId }

func (pt printTask) Execute(tc dag.TaskContext) error {
    fmt.Printf(" >>> PrintTask <<<: %s\n", pt.taskId)
    tc.Logger.Info("PrintTask finished!", "ts", time.Now())
    return nil
}
```

Next, we'll define a simple DAG with two tasks `start` and `finish`, both of
`printTask` type. You can place type definition and function either in `main.go`
file or any other `*.go` file within the same directory.


```go
func printDAG(dagId string) dag.Dag {
    // [start] --> [end]
    start := dag.NewNode(printTask{taskId: "start"})
    start.NextTask(printTask{taskId: "finish"})

    startTs := time.Date(2024, time.March, 11, 12, 0, 0, 0, time.UTC)
    schedule := dag.FixedSchedule{Interval: 10 * time.Second, Start: startTs}

    printDag := dag.New(dag.Id(dagId)).
        AddSchedule(&schedule).
        AddRoot(start).
        Done()
    return printDag
}
```

We can now add this DAG to the `dag.Registry` in our `main` function, like
so:

```go {4-6}
func main() {
    const port = 9321
    meta.ParseASTs(taskGoFiles)
    printDag := printDAG("example")
    dags := dag.Registry{}
    dags[printDag.Id] = printDag

    // Setup default scheduler
    schedulerServer := scheduler.DefaultStarted(dags, "scheduler.db", port)
    // ...
```

Rebuild and rerun the program:

```bash
go generate
go build
./ppacer_demo
```

Every 10 seconds, you should see scheduler logs and our messages from
`printTask` on the console's standard output.


```bash
2024/03/11 23:50:50 INFO Updating dag run task status currentStatus=SCHEDULED newStatus=RUNNING
 >>> PrintTask <<<: finish
2024/03/11 23:50:50 INFO Finished executing task taskToExec="{DagId:example ExecTs:2024-03-11T22:50:50UTC+00:00 TaskId:finish}"
2024/03/11 23:50:50 INFO Start upserting dag run task status dagruntask="{DagId:example AtTime:2024-03-11 22:50:50 +0000 UTC TaskId:finish}" status=SUCCESS
```

You can observe the output for a while, then stop the program. This time,
databases should contain data.


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
DagId    StartTs                       Schedule            CreateTs
-------  ----------------------------  ------------------  -----------------------------------
example  2024-03-11T12:00:00UTC+00:00  FixedSchedule: 10s  2024-03-11T23:50:11.493288CET+01:00
```

### dagruns table


```bash
sqlite3 scheduler.db 'SELECT * FROM dagruns'
```

```
RunId  DagId    ExecTs                        InsertTs                             Status   StatusUpdateTs                       Version
-----  -------  ----------------------------  -----------------------------------  -------  -----------------------------------  -------
1      example  2024-03-11T22:50:20UTC+00:00  2024-03-11T23:50:20.008809CET+01:00  SUCCESS  2024-03-11T23:50:20.040002CET+01:00  0.0.1  
2      example  2024-03-11T22:50:30UTC+00:00  2024-03-11T23:50:30.029023CET+01:00  SUCCESS  2024-03-11T23:50:30.05513CET+01:00   0.0.1  
3      example  2024-03-11T22:50:40UTC+00:00  2024-03-11T23:50:40.046885CET+01:00  SUCCESS  2024-03-11T23:50:40.07069CET+01:00   0.0.1  
4      example  2024-03-11T22:50:50UTC+00:00  2024-03-11T23:50:50.064339CET+01:00  SUCCESS  2024-03-11T23:50:50.088597CET+01:00  0.0.1  
```

### dagruntasks table


```bash
sqlite3 scheduler.db 'SELECT * FROM dagruntasks'
```

```
DagId    ExecTs                        TaskId  InsertTs                             Status   StatusUpdateTs                       Version
-------  ----------------------------  ------  -----------------------------------  -------  -----------------------------------  -------
example  2024-03-11T22:50:20UTC+00:00  start   2024-03-11T23:50:20.017508CET+01:00  SUCCESS  2024-03-11T23:50:20.029982CET+01:00  0.0.1  
example  2024-03-11T22:50:20UTC+00:00  finish  2024-03-11T23:50:20.031029CET+01:00  SUCCESS  2024-03-11T23:50:20.039541CET+01:00  0.0.1  
example  2024-03-11T22:50:30UTC+00:00  start   2024-03-11T23:50:30.035029CET+01:00  SUCCESS  2024-03-11T23:50:30.044957CET+01:00  0.0.1  
example  2024-03-11T22:50:30UTC+00:00  finish  2024-03-11T23:50:30.045843CET+01:00  SUCCESS  2024-03-11T23:50:30.054539CET+01:00  0.0.1  
example  2024-03-11T22:50:40UTC+00:00  start   2024-03-11T23:50:40.052554CET+01:00  SUCCESS  2024-03-11T23:50:40.061641CET+01:00  0.0.1  
example  2024-03-11T22:50:40UTC+00:00  finish  2024-03-11T23:50:40.062699CET+01:00  SUCCESS  2024-03-11T23:50:40.069775CET+01:00  0.0.1  
example  2024-03-11T22:50:50UTC+00:00  start   2024-03-11T23:50:50.071096CET+01:00  SUCCESS  2024-03-11T23:50:50.07821CET+01:00   0.0.1  
example  2024-03-11T22:50:50UTC+00:00  finish  2024-03-11T23:50:50.079578CET+01:00  SUCCESS  2024-03-11T23:50:50.088131CET+01:00  0.0.1  
```

### dagtasks table

```bash
sqlite3 scheduler.db 'SELECT DagId, TaskId, IsCurrent, InsertTs, TaskTypeName FROM dagtasks'
sqlite3 scheduler.db 'SELECT DagId, TaskId, IsCurrent, TaskBodySource FROM dagtasks'
```

```
DagId    TaskId  IsCurrent  InsertTs                             TaskTypeName
-------  ------  ---------  -----------------------------------  ------------
example  start   1          2024-03-11T23:50:11.494468CET+01:00  printTask
example  finish  1          2024-03-11T23:50:11.494468CET+01:00  printTask


DagId    TaskId  IsCurrent  TaskBodySource
-------  ------  ---------  ------------------------------------------------------------
example  start   1          {
                                fmt.Printf(" >>> PrintTask <<<: %s\n", pt.taskId)
                                tc.Logger.Info("PrintTask finished!", "ts", time.Now())
                                return nil
                            }

example  finish  1          {
                                fmt.Printf(" >>> PrintTask <<<: %s\n", pt.taskId)
                                tc.Logger.Info("PrintTask finished!", "ts", time.Now())
                                return nil
                            }
```

## Complete example

The whole source code for above example can be found in here:
[github.com/ppacer/examples](https://github.com/ppacer/examples/tree/main/hello).
