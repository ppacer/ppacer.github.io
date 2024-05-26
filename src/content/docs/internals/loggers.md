---
title: Logging and loggers
---

Ppacer uses Go standard package for structured logging - `log/slog`
([link](https://go.dev/blog/slog)). Loggers are usually passed explicitly to
objects rather than using some kind of global setup. We can distinguish two
types of loggers in ppacer:

* Loggers used in `ppacer/core/*` packages which are used to log **internal**
    information, warnings and potential errors.
* Task loggers which are used by `dag.Task`. Those logs are persisted in a
  separate database, to be displayed on the ppacer UI.


## ppacer internal loggers

By default ppacer uses standard `*slog.Logger` which writes to system standard
out and uses `slog.TextHandler` with severity level set to `Info`. For example
let's take a look at implementation of
[scheduler.New](https://pkg.go.dev/github.com/ppacer/core/scheduler#New)
function which construct `Scheduler`:


```go
func New(
    dbClient *db.Client, queues Queues, config Config, logger *slog.Logger,
) *Scheduler {
	if logger == nil {
		opts := slog.HandlerOptions{Level: slog.LevelInfo}
		logger = slog.New(slog.NewTextHandler(os.Stdout, &opts))
	}
	return &Scheduler{
		dbClient: dbClient,
		config:   config,
		queues:   queues,
		logger:   logger,
		state:    StateStarted,
	}
}
```

As we can see if one pass `nil` for `logger` parameter, then default logger
would be initialized and used. This pattern is common across all top-level
`ppacer/core` objects which methods needs to logs anything.


## Task loggers

By saying "Task logger" we mean a logger which is embedded in
[dag.TaskContext](https://pkg.go.dev/github.com/ppacer/core/dag#TaskContext).
`TaskContext` is then accessible in `Execute` method for every ppacer DAG
task, so we can log related events. Those events will be displayed on the UI,
in context of selected DAG run task.

## Package `tasklog`

Ppacer internal package
[ppacer/core/dag/tasklog](https://pkg.go.dev/github.com/ppacer/core/dag/tasklog)
defines interfaces and their implementation for ppacer task loggers.

In context of task logs there are two actions we want to do. The one is
mentioned logging information from ppacer `dag.Task` and the other one is a way
to read task log records for given DAG run task. It is represented by
`tasklog.Factory` interface:


```go
type tasklog.Factory interface {
    GetLogger(TaskInfo) *slog.Logger
    GetLogReader(TaskInfo) Reader
}

type tasklog.Reader interface {
    ReadAll(context.Context) ([]Record, error)
    ReadLatest(context.Context, int) ([]Record, error)
}

type tasklog.TaskInfo struct {
    DagId  string
    ExecTs time.Time
    TaskId string
}

type tasklog.Record struct {
    Level      string
    InsertTs   time.Time
    Message    string
    Attributes map[string]any
}
```

Methods `GetLogger` and `GetLogReader` are put under the same interface,
because there is always a connection between how log data is written and how it
should be read. It makes sense, to have that logic defined within the same
type.

Using those interfaces we now can say that `exec.Executor` for a given DAG run
task would use `tasklog.Factory.GetLogger` method to instantiate new logger
dedicated for that task. On the other side of the program, the UI or others
clients might use `tasklog.Factory.GetLogReader`, to instantiate a reader for
that task log records.

Those interfaces gives us also a possibility to use persistence layer of choice
for our ppacer task logs. By default ppacer uses SQLite database via
[tasklog.NewSQLite](https://pkg.go.dev/github.com/ppacer/core/dag/tasklog#NewSQLite)
constructor for
[tasklog.SQLite](https://pkg.go.dev/github.com/ppacer/core/dag/tasklog#SQLite).


