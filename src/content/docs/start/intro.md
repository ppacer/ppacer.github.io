---
title: Getting started with ppacer
---

## Intro

For starters we are going to setup new Go project, install ppacer, configure
ppacer scheduler and executor in a single program, define new DAG which would
run each 10 seconds, run the program and eventually explore ppacer database.

:::note
The only requirement is Go compiler in version at least 1.22.
:::


## Installing ppacer

```bash
mkdir ppacer-demo && cd ppacer-demo
go mod init ppacer_demo
go get github.com/ppacer/core@latest
go get github.com/ppacer/core/...
```


## Setting up scheduler and executor

Now we can proceed to start scheduler and executor in a single program. Let's
start with creating file `main.go` with the following content:

```go
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

    // Setup logger and databases
    logger := slog.Default()
    dbClient, dbErr := db.NewSqliteClient("scheduler.db", logger)
    logsDbClient, logsDbErr := db.NewSqliteClientForLogs("logs.db", logger)
    if dbErr != nil || logsDbErr != nil {
        log.Panic(dbErr, logsDbErr)
    }

    // Setup scheduler
    config := scheduler.DefaultConfig
    queues := scheduler.DefaultQueues(config)
    scheduler := scheduler.New(dbClient, queues, config, logger)
    schedulerHttpHandler := scheduler.Start(dags)
    schedulerServer := &http.Server{
        Addr:    fmt.Sprintf(":%d", port),
        Handler: schedulerHttpHandler,
    }

    // Setup and run executor in a separate goroutine
    go func() {
        schedUrl := fmt.Sprintf("http://localhost:%d", port)
        executor := exec.New(schedUrl, logsDbClient, logger, nil)
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

In the current version on `main` function, we parse Go files ASTs (to get Task
source code, more on this later), setup two SQLite databases - one for the
scheduler and the other one for logs. Then we configure and setup the
scheduler. Next step is to setup and start an executor in a separate goroutine.
Finally we start scheduler HTTP server to enable communication between
executors, clients, users and the scheduler.

At this point we don't have any DAG defined yet, but program should compile:

```bash
go build
./ppacer_demo
```

You should be able to see something along those lines

```bash
2024/03/11 23:19:57 INFO Start syncing DAG registry with dags and dagtasks tables
2024/03/11 23:19:57 INFO Finished syncing DAG registry with dags and dagtasks tables duration=237.875µs
```

and then program will run forever. You can kill it for now. Running the
program for the first time should also setup two mentioned SQLite database for
scheduler metadata and logs.


## Defining Task and DAG

Let's now create our first DAG. In ppacer DAGs are directed acyclic graphs made
of [Tasks](https://pkg.go.dev/github.com/ppacer/core/dag#Task), so let's start
there.


```go
type PrintTask struct {
    TaskId string
}

func (pt PrintTask) Id() string { return pt.TaskId }

func (pt PrintTask) Execute(tc dag.TaskContext) error {
    fmt.Printf(" >>> PrintTask <<<: %s\n", pt.TaskId)
    tc.Logger.Info("PrintTask finished!", "ts", time.Now())
    return nil
}
```

Now let's define a simple DAG with just two tasks `start` and `finish`, both of
type `PrintTask`. You can put type definition and function either in `main.go`
file or any other `*.go` file within the same catalog.


```go
func printDAG(dagId string) dag.Dag {
    // [start] --> [end]
    start := dag.NewNode(PrintTask{TaskId: "start"})
    start.NextTask(PrintTask{TaskId: "finish"})

    startTs := time.Date(2024, time.March, 11, 12, 0, 0, 0, time.UTC)
    schedule := dag.FixedSchedule{Interval: 10 * time.Second, Start: startTs}

    printDag := dag.New(dag.Id(dagId)).
        AddSchedule(&schedule).
        AddRoot(start).
        Done()
    return printDag
}
```

At this point we can add a DAG into `dag.Registry` in our main function, like
this:

```go
    ...
    printDag := printDAG("example")
    dags := dag.Registry{}
    dags[printDag.Id] = printDag
    ...
```

After adding new DAG into the registry, feel free to build and run the program
once again


```bash
go build
./ppacer_demo
```

Now each 10 seconds you should see on the console standard output scheduler
logs and our messages from `PrintTask`


```bash
2024/03/11 23:50:50 INFO Updating dag run task status currentStatus=SCHEDULED newStatus=RUNNING
 >>> PrintTask <<<: finish
2024/03/11 23:50:50 INFO Finished executing task taskToExec="{DagId:example ExecTs:2024-03-11T22:50:50UTC+00:00 TaskId:finish}"
2024/03/11 23:50:50 INFO Start upserting dag run task status dagruntask="{DagId:example AtTime:2024-03-11 22:50:50 +0000 UTC TaskId:finish}" status=SUCCESS
```

Feel free to wait for a bit and then terminate the program. This time databases
should not be empty.


## Exploring scheduler database

Currently the frontend for ppacer is not yet implemented, but you can go
straight ahead and look into the scheduler database.


### dags table

```bash
sqlite3 scheduler.db 'SELECT DagId, StartTs, Schedule, CreateTs FROM dags'
```

```bash
DagId    StartTs                       Schedule            CreateTs
-------  ----------------------------  ------------------  -----------------------------------
example  2024-03-11T12:00:00UTC+00:00  FixedSchedule: 10s  2024-03-11T23:50:11.493288CET+01:00
```

### dagruns table


```bash
sqlite3 scheduler.db 'SELECT * FROM dagruns'
```

```bash
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

```bash
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

```
sqlite3 scheduler.db 'SELECT DagId, TaskId, IsCurrent, InsertTs, TaskTypeName FROM dagtasks'
sqlite3 scheduler.db 'SELECT DagId, TaskId, IsCurrent, TaskBodySource FROM dagtasks'
```

```bash
DagId    TaskId  IsCurrent  InsertTs                             TaskTypeName
-------  ------  ---------  -----------------------------------  ------------
example  start   1          2024-03-11T23:50:11.494468CET+01:00  PrintTask
example  finish  1          2024-03-11T23:50:11.494468CET+01:00  PrintTask


DagId    TaskId  IsCurrent  TaskBodySource
-------  ------  ---------  ------------------------------------------------------------
example  start   1          {
                                fmt.Printf(" >>> PrintTask <<<: %s\n", pt.TaskId)
                                tc.Logger.Info("PrintTask finished!", "ts", time.Now())
                                return nil
                            }

example  finish  1          {
                                fmt.Printf(" >>> PrintTask <<<: %s\n", pt.TaskId)
                                tc.Logger.Info("PrintTask finished!", "ts", time.Now())
                                return nil
                            }
```








