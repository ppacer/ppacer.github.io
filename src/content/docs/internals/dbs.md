---
title: Databases
---

Ppacer uses a database to persist metadata of processes, their schedules, runs
and so on. Default configuration uses SQLite as the database, but in fact any
database which provides a driver for standard Go `database/sql` package can be
supported.

All interactions with the database are made through `ppacer/core/db.Client` (API
reference [here](https://pkg.go.dev/github.com/ppacer/core/db#Client)).


```go
// DB defines a set of operations required from a database. Most of methods are
// identical with standard `*sql.DB` type.
type DB interface {
	Begin() (*sql.Tx, error)
	Exec(query string, args ...any) (sql.Result, error)
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	Close() error
	DataSource() string
	Query(query string, args ...any) (*sql.Rows, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRow(query string, args ...any) *sql.Row
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Client represents the main database client.
type Client struct {
	dbConn DB
	logger *slog.Logger
}
```

As mentioned default configuration uses SQLite. It's materialized via
[db.NewSqliteClient](https://pkg.go.dev/github.com/ppacer/core/db#NewSqliteClient).
For unit tests and integration tests ppacer uses
[db.NewInMemoryClient](https://pkg.go.dev/github.com/ppacer/core/db#NewInMemoryClient)
or
[db.NewSqliteTmpClient](https://pkg.go.dev/github.com/ppacer/core/db#NewSqliteTmpClient).


## Database schema

Database schemas are developed and maintained directly from ppacer
`ppacer/core/db` package source code. Function
[db.SchemaStatements](https://pkg.go.dev/github.com/ppacer/core/db#SchemaStatements)
for a given SQL driver name returns a list of SQL statements that sets up
ppacer database schema.


## Support for other databases

Supporting other databases are planned after the MVP phase, so when we'll have
UI implemented. The first in line is PostgreSQL.

