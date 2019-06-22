![Lapidus](http://i.imgur.com/Snuzp9w.png)

# Lapidus

[![Build Status](https://travis-ci.org/JarvusInnovations/lapidus.svg)](https://travis-ci.org/JarvusInnovations/lapidus)
[![Coverage Status](https://coveralls.io/repos/JarvusInnovations/lapidus/badge.svg?branch=master&service=github)](https://coveralls.io/github/JarvusInnovations/lapidus?branch=master)
[![Join the chat at https://gitter.im/JarvusInnovations/lapidus](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/JarvusInnovations/lapidus?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# Getting Started
Currently MySQL and PostgreSQL databases are fully supported. MongoDB supports inserts and deletes, however, updates
return a copy of the operation (for example, a `$rename` operation will return a `$set` for the new field and an
`$unset` for the old field) instead of the object as it exists in the database. Redis support is on the way. Lapidus can
currently be used as a daemon or Node.js module. Support for piping line-delimited JSON to other processes is a high
priority.

## To install
```
npm install -g lapidus
```

## PostgreSQL
You'll need PostgreSQL 9.4 or higher with logical replication configured and the
[JSONCDC](https://github.com/instructure/jsoncdc) plugin installed and loaded. Any PostgreSQL fork that ships with
`pg_recvlogical` *should* be compatible.

**To install the [JSONCDC](https://github.com/instructure/jsoncdc) logical decoding plugin using pgxn:**
```shell
sudo easy_install pgxnclient
pgxn install jsoncdc --testing
```

_NOTE: JSONCDC also provides .debs inside their releases repo, if you wish to not install through pgxn._

**To enable logical decoding and the JSONCDC plugin add the following lines to your postgresql.conf:**
```
wal_level = logical
max_wal_senders = 10
max_replication_slots = 10

shared_preload_libraries = 'jsoncdc'
```

**Create a user with replication privileges and add them to your pg_hba.conf file.**

**Afterwards, restart PostgreSQL and verify that it starts correctly:**
```
service postgresql restart
service postgresql status
```

**WARNING:** PostgreSQL will hold onto the WAL logs until all logical replication slots have consumed their data. This
means that if you try out Lapidus and fail to delete your slot that you'll likely run out of disk space on your system.

For information on managing replication slots:
[consult the documentation](http://www.postgresql.org/docs/9.5/static/functions-admin.html#FUNCTIONS-REPLICATION).

## MySQL
You'll need MySQL 5.1.15 or higher with binary logging configured. Forks of MySQL should be compatible but have not been
tested.

**Add the following lines to your my.cnf:**
```shell
server-id        = 1
log_bin          = /var/log/mysql/mysql-bin.log
max_binlog_size  = 100M  # WARNING: make sure to set this to a sane value or you may fill your disk
expire_logs_days = 10    # Optional
binlog_format    = row
```

**Create a user with replication permissions and select permissions:**
```sql
GRANT REPLICATION SLAVE, REPLICATION CLIENT, SELECT ON *.* TO 'lapidus'@'localhost' IDENTIFIED BY 'secure-password';
```

**Restart MySQL and verify that it starts correctly:**
```
service mysql restart
service mysql status
```

## MongoDB
We test against MongoDB 3.x, however, older versions should work. You'll need to setup MongoDB as a replica set. If
you're not truly using replication during development you will need to connect and run:

```javascript
// DO NOT DO THIS IN PRODUCTION
rs.initiate()
db.getMongo().setSlaveOk();
```

For more information on setting up replication in MongoDB
[check out the docs](http://docs.mongodb.org/manual/tutorial/deploy-replica-set/).

## Configuration
Lapidus will search for lapidus.json in the current working directory. You can specify a different configuration by
passing it to the constructor or using the ``-c`` flag on the terminal. For a list of command line options run
``lapidus --help``.

Here is a sample configuration file that will connect to two PostgreSQL backends, two MySQL backends, one MongoDB
backend and publish all events to NATS using the NATS plugin:

```javascript
{
  "backends": [
    {
      "type": "mysql",
      "hostname": "127.0.0.1",
      "username": "jacob",
      "database": "jacob",
      "password": "2PQM9aiKMJX5chv76gYdFJNi",
      "serverId": 1,
      "excludeTables": [
        "sessions"
      ]
    },

    {
      "type": "mysql",
      "hostname": "127.0.0.1",
      "username": "sawyer",
      "database": "sawyer",
      "password": "2PQM9aiKMJX5chv76gYdFJNi",
      "serverId": 2
    },

    {
      "type": "postgresql",
      "host": "127.0.0.1",
      "user": "lapidus",
      "database": "lapidus",
      "password": "2PQM9aiKMJX5chv76gYdFJNi",
      "slot": "lapidus_slot"
    },

    {
      "type": "postgresql",
      "host": "127.0.0.1",
      "user": "hurley",
      "database": "hurley",
      "password": "2PQM9aiKMJX5chv76gYdFJNi",
      "slot": "hurley_slot"
    },

    {
      "type": "mongo",
      "hostname": "127.0.0.1",
      "username": "lapidus",
      "database": "lapidus",
      "password": "2PQM9aiKMJX5chv76gYdFJNi",
      "replicaSet": "rs0"
    }
  ],
  "plugins": {
    "nats": {
      "server": "nats://localhost:4222"
    }
  }
}
```

# Plugins
## NATS
Lapidus ships with a lightweight NATS plugin. NATS is an open-source, high-performance, lightweight cloud native
messaging system.

###Configuration

***Publish to NATS for all backends (one connection per backend):***
```javascript
{
  "backends": [...]
  ],
  "plugins": {
    "nats": {
      "server": "nats://localhost:4222"
    }
  }
}
```

***Publish to NATS for a specific backend:***
```javascript
{
  "backends": [
    {
      "type": "postgresql",
      "host": "the.hatch",
      "user": "desmond",
      "database": "darma",
      "password": "notpennysboat123",
      "slot": "walts_raft",

      "plugins": {
        "nats": {
          "server": "nats://localhost:4222"
        }
      }
    }
  ]
}
```

### Events
Insert, Update and Delete events will be published using the subject ``schema.table.pk``. Here are examples events:

**Insert:**
```javascript
// TODO: sample insert
```

**Update:**
```javascript
// TODO: sample update
```

**Delete:**
```javascript
// TODO: sample delete
```

# Production usage
Lapidus worked well for 5k concurrent clients on $5-10 Digital Ocean droplets using the MySQL and PostgreSQL backends
and per-tenant socket.io servers using the NATS plugin. Typical latency between MySQL -> Lapidus -> NATS within a
datacenter was 1ms - 3ms. Since our messages were fire-and-forget, we never solved for the gotchas below and our
end-user lag and CPU usage were neglible . Since NATS will disconnect slow consumers there was good tenant isolation
without much work.

# Gotchas
To prevent a deluge of events during bulk loading of data or restoration of backups make sure your procedures/scripts
stop Lapidus and/or delete/reset any persistent subscriptions or message queues external to Lapdidus as needed.

# Resource requirements

## CPU
CPU usage is light, as a rule of thumb, measure your peak MySQL CPU usage (after enabling binary logging) and multiply
that by 0.075. That's how much CPU Lapidus is likely to use at peak.

## Memory
Generally speaking, each worker requires 10-15 MB of ram.

Your peak memory usage is dictated by V8's garbage collection. When running the TPC-C benchmark against the MySQL worker
using 8 cores memory sat around 70MB and peaked at 120MB before garbage collection knocked it back down to 70MB.

I tested for memory leaks by running 5 million transactions using the TPC-C benchmark and things look pretty solid,
if you notice any issues please report them.

# License
Lapidus is MIT licensed. The artwork in the header is Copyright [Matt Greenholt](http://mattgreenholt.blogspot.com/).

# Contributors
Matt Greenholt has kindly allowed the use of his artwork. Check out his [blog](http://mattgreenholt.blogspot.com/) and
[flickr](https://www.flickr.com/photos/38457242@N00/).
