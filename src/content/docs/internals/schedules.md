---
title: Schedules
---

Processes in ppacer can be either triggered manually or run on a schedule.
Schedules are defined via any Go type which satisfies the following interface
from
[ppacer/core/dag/schedule](https://pkg.go.dev/github.com/ppacer/core/dag/schedule)
package:


```go
type Schedule interface {
	Start() time.Time
	Next(curentTime time.Time, prevSchedule *time.Time) time.Time
	String() string
}
```

As we can see, a schedule is any type that can indicate when it starts via the
`Start` method. It can also determine when the next execution is going to be
scheduled based on the current time and the previous scheduled execution time
using `Next` method. The `String` method provides a way to serialize the
schedule name or highlight. Mostly to keep that information in the database and
to show it on the UI.


Standard `ppacer/core/dag/schedule` package provides implementation for
commonly used schedules.


## Fixed interval schedule

Possibly the simplest regular schedule is fixed interval schedule, which starts
at given time and ticks every fixed time duration.

```go
start := time.Date(2024, 3, 21, 21, 22, 0, 0, time.UTC)
sched := schedule.NewFixed(start, 10 * time.Minute)

nextAfterStart := sched.Next(start, nil)
fmt.Printf("%+v\n", nextAfterStart)

// 2024-03-21 21:32:00 +0000 UTC
```

There are also few helper schedules based on `Fixed` schedule -
`schedule.EveryMinute`, `schedule.Hourly` and `schedule.Daily`. More details
can be found in API reference for `ppacer/dag/schedule` package.


## cron

The second example is based on iconic `*-UNIX` scheduler
[cron](https://en.wikipedia.org/wiki/Cron). Cron uses syntax composed of five
elements representing schedule expression:


```
# ┌───────────── minute (0–59)
# │ ┌───────────── hour (0–23)
# │ │ ┌───────────── day of the month (1–31)
# │ │ │ ┌───────────── month (1–12)
# │ │ │ │ ┌───────────── day of the week (0–6) (Sunday to Saturday;
# │ │ │ │ │                                   7 is also Sunday on some systems)
# │ │ │ │ │
# │ │ │ │ │
# * * * * * <command to execute>
```

Cron's schedule expression format was influential on modern schedulers like
Apache Airflow and Dagster where this format is supported or even used as
default way of defining schedules.

In ppacer cron expressions are implemented via `schedule.Cron` type in
`ppacer/core/dag/schedule` package. Instead of using string, to initialize cron
expression, you can use fluent API. For example, it can looks like the
following:


```go
sched := schedule.NewCron().
    AtMinute(10).
    AtHours(8, 16).
    OnWeekday(time.Monday)
sched.String() // 10 8,16 * * 1
```

By default `schedule.NewCron()` return default schedule `* * * * *` which ticks
every minute.


## Custom schedule

There are cases when `cron` or other regular schedules aren't a good fit for
defining a schedule for our processes.

### Simple custom schedule

Let's say we have a process that needs to run on Friday afternoon (6 pm), just
before the weekend, and then on Monday morning (8 am), just after the weekend.
Such simple schedule cannot be expressed neither by cron, nor by fixed interval
schedule. Let's try to implement this schedule.

```go
type AroundWeekend struct {
    start time.Time
}

func NewAroundWeekend(start time.Time) *AroundWeekend {
    return &AroundWeekend{start: start}
}

func (aw *AroundWeekend) String() string {
    return "Fri 6pm & Mon 8am"
}

func (aw *AroundWeekend) Next(current time.Time, prevSched *time.Time) time.Time {
    if prevSched != nil {
        ps := *prevSched
        if ps.Weekday() == time.Friday {
            monday := ps.Add(3 * 24 * time.Hour)
            return time.Date(monday.Year(), monday.Month(), monday.Day(),
                8, 0, 0, 0, ps.Location())
        }
        if ps.Weekday() == time.Monday {
            friday := ps.Add(4 * 24 * time.Hour)
            return time.Date(friday.Year(), friday.Month(), friday.Day(),
                18, 0, 0, 0, ps.Location())
        }
    }
    // TODO
}
```

We can easily implement this schedule given we can use previous schedule point.
That's usually on the hot path, because we always has previous schedule point,
except for the first point. Calculating `Next` for the first point is also
fairly straightforward:

```go
    // ...
    // the following should be run only for the first point in the schedule
    cwd := current.Weekday()
    afterMondayMorning := (cwd > time.Monday && cwd < time.Friday) ||
        (cwd == time.Monday && (current.Hour() > 8 ||
            current.Hour() == 8 && current.Minute() > 0)) ||
        (cwd == time.Friday && current.Hour() < 18)
    if afterMondayMorning {
        daysToFriday := int(time.Friday - cwd)
        friday := current.Add(time.Duration(daysToFriday) * 24 * time.Hour)
        return time.Date(friday.Year(), friday.Month(), friday.Day(),
            18, 0, 0, 0, current.Location())
    }
    daysToMonday := (8 - int(cwd)) % 7
    monday := current.Add(time.Duration(daysToMonday) * 24 * time.Hour)
    return time.Date(monday.Year(), monday.Month(), monday.Day(),
        8, 0, 0, 0, current.Location())
}
```

As a really quick test we can try to generate few time points from that
schedule. Let's start at `2024-03-31 13:30 (Sunday)`:


```
 --- Around Weekend Schedule ---
Next(2024-03-31 13:30:00 +0000 UTC) = 2024-04-01 08:00:00 +0000 UTC (Monday)
Next(2024-04-01 08:00:00 +0000 UTC) = 2024-04-05 18:00:00 +0000 UTC (Friday)
Next(2024-04-05 18:00:00 +0000 UTC) = 2024-04-08 08:00:00 +0000 UTC (Monday)
Next(2024-04-08 08:00:00 +0000 UTC) = 2024-04-12 18:00:00 +0000 UTC (Friday)
Next(2024-04-12 18:00:00 +0000 UTC) = 2024-04-15 08:00:00 +0000 UTC (Monday)
```


### Cron modification

Now we try to define a bit more complex scheduling logic depending on cron
schedule modifications. Let's say our DAG needs to run on everyday at 10:15 am
but in June and August it shouldn't run on Fridays and on Christmas eve it
should run at 08:00 am.


```go
package main

import (
    "fmt"
    "time"

    "github.com/ppacer/core/dag/schedule"
)

type MyCustomSched struct {
    start     time.Time
    dailyCron *schedule.Cron
}

func NewCustomSched(hour, minute int, start time.Time) *MyCustomSched {
    cron := schedule.NewCron().AtHour(hour).AtMinute(minute)
    return &MyCustomSched{
        start:     start,
        dailyCron: cron,
    }
}

func (mcs *MyCustomSched) Start() time.Time { return mcs.start }

func (mcs *MyCustomSched) String() string {
    return fmt.Sprintf("MyCustomSched: %s", mcs.dailyCron.String())
}

func (mcs *MyCustomSched) Next(currentTime time.Time, _ *time.Time) time.Time {
    cronNext := mcs.dailyCron.Next(currentTime, nil)
    if cronNext.Month() == time.June || cronNext.Month() == time.August {
        if cronNext.Weekday() == time.Friday {
            return mcs.dailyCron.Next(cronNext, nil)
        }
    }
    if cronNext.Month() == time.December && cronNext.Day() == 24 {
        return time.Date(
            cronNext.Year(), cronNext.Month(), cronNext.Day(), 8, 0, 0, 0,
            cronNext.Location(),
        )
    }
    return cronNext
}

func main() {
    start := time.Date(2024, 4, 1, 8, 0, 0, 0, time.UTC)
    mySched := NewCustomSched(10, 15, start)
    fmt.Println(mySched.String())

    rand := time.Date(2024, time.April, 2, 7, 0, 0, 0, time.UTC)
    summerFriday := time.Date(2024, time.August, 9, 9, 30, 0, 0, time.UTC)
    beforeXMas := time.Date(2024, time.December, 23, 12, 0, 0, 0, time.UTC)

    fmt.Printf("Next sched for %v: %v\n", rand, mySched.Next(rand, nil))
    fmt.Printf("Next sched for Friday in August (%v): %v\n", summerFriday,
        mySched.Next(summerFriday, nil))
    fmt.Printf("Next sched for one day before XMas (%v): %v\n", beforeXMas,
        mySched.Next(beforeXMas, nil))
}
```

In the above code we defined `MyCustomSched` type which uses regular
`schedule.Cron` schedule and additional custom scheduling logic in `Next`
method to reflect our specific schedule implementation. The whole code snippet
is complete working Go program including example uses of `MyCustomSched`
schedule for several dates.

You can find in
[ppacer/examples/custom-schedule](https://github.com/ppacer/examples/tree/main/custom-schedule).
Let's compile and run the above example.

```bash
go build
./custom_schedule
```

Output of this program should be:

```
MyCustomSched: 15 10 * * *
Next sched for 2024-04-02 07:00:00 +0000 UTC: 2024-04-02 10:15:00 +0000 UTC
Next sched for Friday in August (2024-08-09 09:30:00 +0000 UTC): 2024-08-10 10:15:00 +0000 UTC
Next sched for one day before XMas (2024-12-23 12:00:00 +0000 UTC): 2024-12-24 08:00:00 +0000 UTC
```
