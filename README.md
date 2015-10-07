![Lapidus](http://i.imgur.com/Snuzp9w.png)
# Lapidus

[![Build Status](https://travis-ci.org/JarvusInnovations/lapidus.svg)](https://travis-ci.org/JarvusInnovations/lapidus)
[![Coverage Status](https://coveralls.io/repos/JarvusInnovations/lapidus/badge.svg?branch=master&service=github)](https://coveralls.io/github/JarvusInnovations/lapidus?branch=master)

# Getting Started
Currently MySQL and PostgreSQL databases are supported with MongoDB and Redis support on the way. Lapidus can be used


## PostgreSQL
You'll need PostgreSQL 9.4 or higher with logical replication configured and the decoding_json plugin installed and
loaded. Forks of PostgreSQL should be compatible provided they ship with pg_recvlogical.

** To install the decoding_json logical decoding plugin on Ubuntu: **
```shell
# Ubuntu / Debian
git clone https://github.com/leptonix/decoding-json.git
cd decoding-json
sudo apt-get install postgresql-server-dev-9.5
make
sudo cp decoding_json.so /usr/lib/postgresql/9.5/lib/
```

** To enable logical decoding and the decoding_json plugin add the following lines to your postgresql.conf: **
```
wal_level = logical
max_wal_senders = 10
max_replication_slots = 10
shared_preload_libraries = 'decoding_json'
```

** Create a user with replication privileges and add them to your pg_hba.conf file. **

** Afterwards, restart PostgreSQL and verify that it starts correctly: **
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

** Add the following lines to your my.cnf: **
```shell
server-id        = 1
log_bin          = /var/log/mysql/mysql-bin.log
max_binlog_size  = 100M  # WARNING: make sure to set this to a sane value or you may fill your disk
expire_logs_days = 10    # Optional
binlog_format    = row
```

** Create a user with replication permissions: **
```
GRANT REPLICATION SLAVE, REPLICATION CLIENT, SELECT ON *.* TO 'lapidus'@'localhost' IDENTIFIED BY 'secure-password';
```

** Restart MySQL and verify that it starts correctly: **
```
service mysql restart
service mysql status
```

## Configuration
Lapidus will search for lapidus.json in the current working directory. You can specify a different configuration by
passing it to the constructor or using the ``-c`` flag on the terminal. For a list of command line options run
``lapidus --help``.

Here is a sample configuration file that will connect to two PostgreSQL backends, two MySQL backends and publish all
events to NATS using the NATS plugin:

```javascript
{
  "backends": [
    {
      "type": "mysql",
      "hostname": "127.0.0.1",
      "username": "jacob",
      "database": "jacob",
      "password": "2PQM9aiKMJX5chv76gYdFJNi",
      "serverId": 1
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
    }
  ],
  "plugins": {
    "nats": {
      "server": "nats://10.240.103.217:4222"
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

### Caveats

* At this time, transactions and other event types are not published to NATS.
* Each worker uses its own connection to NATS using non-blocking event emitters; out of order delivery is likely.
* NATS does not guarantee in order delivery so a blocking variant is not likely (it's 10-20 LoC if you're interested).

# License
Lapidus is MIT licensed. The artwork in the header is Copyright [Matt Greenholt](http://mattgreenholt.blogspot.com/).

# Contributors
Matt Greenholt has kindly allowed the use of his artwork. Check out his [blog](http://mattgreenholt.blogspot.com/) and [flickr](https://www.flickr.com/photos/38457242@N00/).
