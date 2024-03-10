---
title: Schedules
---

**TODO**


```go
type Schedule interface {
	StartTime() time.Time
	Next(time.Time, *time.Time) time.Time
	String() string
}
```

