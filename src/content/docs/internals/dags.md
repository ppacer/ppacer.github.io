---
title: DAGs
---

The most common activity for developers who needs to use a scheduler is
designing and implementing processes. In ppacer, similar to other schedulers,
those processes are called *DAGs* which is short from directed acyclic graphs.
In context of data structures DAGs are just a subgroup of graphs, but in
context of schedulers we mean rather the process which is expressed as directed
acyclic graph of tasks.


## Tasks

**TODO**

## DAGs in ppacer

**TODO**

## DAGs registry

**TODO**

## Tests and validations for DAGs

**TODO**


## Limitations

* Be aware of max number of tasks in a DAG - link to Go docs
* For now DAGs can be only composed of Tasks. Another DAG cannot be referenced
  within a DAG. This feature will be implemented after version `0.1`.
