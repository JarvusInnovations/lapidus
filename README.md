![Lapidus](http://i.imgur.com/Snuzp9w.png)
# Lapidus

[![Build Status](https://travis-ci.org/JarvusInnovations/lapidus.svg)](https://travis-ci.org/JarvusInnovations/lapidus)
[![Coverage Status](https://coveralls.io/repos/JarvusInnovations/lapidus/badge.svg?branch=master&service=github)](https://coveralls.io/github/JarvusInnovations/lapidus?branch=master)

# Configuration
Currently MySQL and PostgreSQL databases are supported with MongoDB and Redis support on the way.

## PostgreSQL
You'll need PostgreSQL 9.4 or higher with logical replication and install the decoding_json plugin. Forks of PostgreSQL
should be compatible provided they ship with pg_recvlogical.
```shell
# TODO: How to setup PostgreSQL
```

## MySQL
You'll need MySQL 5.1.15 or higher with binary logging configured. Forks of MySQL should be compatible but have not been
tested.
```shell
# TODO: How to setup MySQL
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
