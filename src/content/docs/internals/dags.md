---
title: DAGs
---

The most common activity for developers who needs to use a scheduler is
designing and implementing processes. In ppacer, similar to other schedulers,
those processes are called *DAGs* which is short for directed acyclic graphs.
In context of data structures DAGs are just a subgroup of graphs, but in
context of schedulers we mean rather the process which is expressed as directed
acyclic graph of tasks.


## Tasks

In ppacer `Task` is defined via interface. The interface is straighforward and
looks like this

```go
type TaskContext struct {
    Context context.Context
    Logger  *slog.Logger
    DagRun  RunInfo
}

type Task interface {
    Id() string
    Execute(TaskContext) error
}
```

Basically any type which implements method `Id()`, to return task identifier
and `Execute(...)` to execute the task body is treated as `Task`. As we can see
method `Execute` accepts `TaskContext` and via this parameter task body has
access to DAG run information, like execution time, task logger and more. Task
returns error. When `Execute` method returns non-nil error, then task is
treated by the scheduler as failed.

One of simplest and useless `Task` implementation might looks like the
following:

```go
type emptyTask struct {
    taskId string
}

func (et emptyTask) Id() string { return et.taskId }
func (et emptyTask) Execute(_ dag.TaskContext) error { return nil }
```

Defined `emptyTask` task does nothing but finishes immediately, always without
an error.


## Nodes

Before we dive into DAGs, we need to mention another abstraction -
`dag.Node`. One can say it's implementation detail but it might be handy later
and it's good to know about it. In the last chapter we learned about `dag.Task`
interface to represent generic tasks, but tasks aren't enough to define graph
structure of dependencies between tasks. For this reason `dag.Node` exists.


```go
type Node struct {
    Task     Task
    Children []*Node
}

```

As we can see it's a simple recursive data structure to represent single node
in a DAG, which has a Task and pointers to children nodes. Most of the API is
designed to work with `Task`, but sometimes it's more convenient to use
`*Node`.


## DAGs

DAGs in ppacer are defined via `dag.Dag`
([docs](https://pkg.go.dev/github.com/ppacer/core/dag#Dag)) objects. It
contains information about

* `Id` - DAG identifier
* `Root` - a pointer to the root of `Task` graph via `*dag.Node`
* `Schedule` - a schedule for this DAG runs
* `Attr` - additional attributes


One can you fluent API, to create a new `dag.Dag` instance. Simple example
might look like the following


```go
start := dag.NewNode(emptyTask{taskId: "start"})

mockDag := dag.New(dag.Id("mock")).
    AddRoot(start).
    AddAttributes(dag.Attr{CatchUp: True}).
    Done()
```

The example above doesn't include a schedule. In this case run of this DAG can
be triggered manually. More about schedules can be found in
[Schedules](/internals/schedules/).


Usually a DAG of tasks can become pretty complex with rather high number of
tasks in complicated shapes. We can easily split creating tasks graph and
defining `dag.Dag` in separate functions.


```go "linkedList" "mockDagTasks"
func linkedList(prefix string, n int) *dag.Node {
    s := dag.NewNode(emptyTask{taskId: prefix})
    prev := s
    for i := 0; i < n-1; i++ {
        taskId := fmt.Sprintf("step_%s_%d", prefix, i)
        task := emptyTask{taskId: taskId}
        prev = prev.NextTask(task)
    }
    return s
}

func mockDagTasks() *dag.Node {
    start := dag.NewNode(emptyTask{taskId: "start"})
    llPath1Start := linkedList("path1", 5)
    llPath2Start := linkedList("path2", 3)
    llPath3Start := linkedList("path3", 4)

    start.Next(llPath1Start)
    start.Next(llPath2Start)
    start.Next(llPath3Start)

    return start
}

func createMockDag() dag.Dag {
    return dag.New(dag.Id("mock")).AddRoot(mockDagTasks()).Done()
}
```

In the example above we defined a function `linkedList` which creates a linked
list out of `emptyTask` and returns pointer to its start (head). Next we've
used that function, to create more complex graph of tasks, starting with
`start` empty task and attaching to it three independent linked lists of
`emptyTasks`. That function also returns pointer to the start node. Finally we
have another function which returns a new DAG and as tasks entry point it uses
`start` task from the previous function.


## DAGs registry

DAGs registry is simply a collection of DAGs. In Go is represented as `type
Registry map[Id]Dag`. It meant to be a repository for all DAGs in your program.
Object `dag.Registry` is one of the main inputs for `DagWatcher` and
`TaskScheduler`. DAGs from there are synced with the database on ppacer
startup.

It's up to you how you want to build your `dag.Registry`. In the simplest case
you can just instantiate `dag.Registry` in the `main` function and add your
DAGs there. You could have a single function which gathers all DAGs definitions
and returns `dag.Registry`. Another example is you could have package-level
variable for the registry and multiple packages on `init()` would append DAGs
definition in that object. It doesn't really matter how you create the
registry, the only thing important is having it defined before you initialize
the Scheduler.


## Tests and validations for DAGs

The first and most obvious test you should have for your DAGs is verifying that
graph of tasks are actually directed acyclic graphs. Given that you have a
function which builds your registry, you can do it like this


```go
func TestDagsIsValid(t *testing.T) {
    dags := buildDagsRegistry()
    for id, dag := range dags {
        if !dag.IsValid() {
            t.Errorf("DAG %s is not a valid DAG", string(id))
        }
    }
}
```

Please don't stop on this test. Given that `dag.Dag` are regular Go structures,
you can use standard Go testing techniques.


## Limitations

* Be aware of max number of tasks in a DAG -
  [MAX_RECURSION](https://pkg.go.dev/github.com/ppacer/core/dag#pkg-constants).
