var EventEmitter = require('events').EventEmitter,
    ZongJi = require('zongji');

function MySql(cfg) {
    'use strict';

    var self = this;

    this.zongji = new ZongJi({
        host: cfg.hostname,
        user: cfg.username,
        password: cfg.password
    });

    this.serverId = cfg.serverId || (++MySql.prototype.serverId);

    EventEmitter.call(this);

    this.zongji.on('error', function(error) {
       self.emit('error', error);
    });

    // In V8 it's 8.7x slower to lookup an undefined property than to read a boolean value, so we'll explicitly values.

    Object.defineProperty(this, "_emitEvents", {
        enumerable: false,
        writable: true
    });

    this._emitEvents = (typeof cfg.emitEvents === 'boolean') ? cfg.emitEvents : true;

    this.emitInsert = (typeof cfg.emitInsert === 'boolean') ? cfg.emitInsert : this._emitEvents;
    this.emitUpdate = (typeof cfg.emitUpdate === 'boolean') ? cfg.emitUpdate : this._emitEvents;
    this.emitDelete = (typeof cfg.emitDelete === 'boolean') ? cfg.emitDelete : this._emitEvents;
    this.emitEvent =  (typeof cfg.emitEvent === 'boolean') ? cfg.emitEvent : this._emitEvents;
    this.emitError = (typeof cfg.emitEvent === 'boolean') ? cfg.emitEvent : true;

    this.onInsert = (typeof cfg.onInsert === 'function') ? cfg.onInsert.bind(this) : false;
    this.onUpdate = (typeof cfg.onUpdate === 'function') ? cfg.onUpdate.bind(this) : false;
    this.onDelete = (typeof cfg.onDelete === 'function') ? cfg.onDelete.bind(this) : false;
    this.onEvent =  (typeof cfg.onEvent === 'function')  ? cfg.onEvent.bind(this)  : false;
    this.onError =  (typeof cfg.onError === 'function')  ? cfg.onError.bind(this)  : false;

    if (this.emitError || this.onError) {
        this.zongji.on('error', function (error) {
            self.emitError && self.emit('error', error);
            self.onError && self.onError(error);
        });
    }

    Object.defineProperty(this, '_onEventsWrapper', {
        enumerable: false,
        writable: true
    });

    this._onEventsWrapper = (typeof cfg.onEventsWrapper === 'function') ? cfg.onEventsWrapper : false;

    this.onInsertWrapper = (typeof cfg.onInsertWrapper === 'function') ? cfg.onInsertWrapper : this._onEventsWrapper;
    this.onUpdateWrapper = (typeof cfg.onUpdateWrapper === 'function') ? cfg.onUpdateWrapper : this._onEventsWrapper;
    this.onDeleteWrapper = (typeof cfg.onDeleteWrapper === 'function') ? cfg.onDeleteWrapper : this._onEventsWrapper;
    this.onEventWrapper  = (typeof cfg.onEventWrapper === 'function')  ? cfg.onEventWrapper : this._onEventsWrapper;

    this.schemaTableMap = cfg.schemaTableMap || {};
}

MySql.prototype = new EventEmitter();
MySql.prototype.serverId = 0;

Object.defineProperty(MySql.prototype, 'onEventsWrapper', {
    set: function (val) {
        val = (typeof val === 'function') ? val : false;

        this.onInsertWrapper = (this.onInsertWrapper === this._onEventsWrapper) ? val : this.onInsertWrapper;
        this.onDeleteWrapper = (this.onDeleteWrapper === this._onEventsWrapper) ? val : this.onDeleteWrapper;
        this.onUpdateWrapper = (this.onUpdateWrapper === this._onEventsWrapper) ? val : this.onUpdateWrapper;
        this.onEventWrapper  = (this.onEventWrapper  === this._onEventsWrapper) ? val : this.onEventWrapper;

        this._onEventsWrapper = val;
    },

    get: function () {
        return this._onEventsWrapper;
    }
});

Object.defineProperty(MySql.prototype, 'emitEvents', {
    set: function (val) {
        this.emitInsert = val;
        this.emitUpdate = val;
        this.emitDelete = val;
        this.emitEvent = val;

        this._emitEvents = val;
    },

    get: function () {
        return !!this._emitEvents;
    }
});

MySql.prototype._binLogHandler = function _binLogHandler(evt) {
    var self = this,
        eventName = evt.getEventName(),
        tableMap = evt.tableMap[evt.tableId],
        tableName = evt.tableMap[evt.tableId].tableName,
        schemaName = evt.tableMap[evt.tableId].parentSchema,
        pk, row, len, x, event, constraints;

    if (self.excludeTables) {
        if (self.excludeTables.indexOf(tableName) !== -1) {
            return;
        }
    }

    if (eventName === 'tablemap') {
        self.schemaTableMap[schemaName] || (self.schemaTableMap[schemaName] = {});
        self.schemaTableMap[schemaName][tableName] || (self.schemaTableMap[schemaName][tableName] = {});

        constraints = {};

        evt.tableMap[evt.tableId].columns.forEach(function(column) {
            var constraint = column.constraint;

            if (constraint && (constraint.type === 'PRIMARY KEY' || constraint.type === 'UNIQUE')) {
                constraints[constraint.name] ||  (constraints[constraint.name] = []);
                constraints[constraint.name][constraint.position-1] = column.name;
            }
        });

        if (constraints.PRIMARY) {
            tableMap.pk = constraints.PRIMARY[0];
        }

        tableMap.constraints = constraints;

        self.schemaTableMap[schemaName][tableName] = tableMap;

        return;
    }

    // TODO: How can we fallback to identifying a row by a UNIQUE constraint in absence of a PRIMARY KEY?
    pk = self.schemaTableMap[schemaName][tableName].pk;
    len = evt.rows.length;

    if (eventName === 'deleterows') {
        for (x = 0; x < len; x++) {
            row = evt.rows[x];

            event = {
                pk: row[pk],
                table: tableName,
                schema: schemaName
            };

            if (self.onDelete) {
                if (self.onDeleteWrapper) {
                    self.onDeleteWrapper(function() {
                        self.onDelete(event, evt);
                    });
                } else {
                    self.onDelete(event, evt);
                }
            }

            if (self.onEvent) {
                if (self.onEventWrapper) {
                    self.onEventWrapper(function() {
                        self.onEvent(event, evt);
                    });
                } else {
                    self.onEvent(event, evt);
                }
            }

            self.emitDelete && self.emit('delete', event);

            if (self.emitEvent) {
                event.type = 'delete';
                self.emit('event', event);
            }
        }
    } else if (eventName === 'writerows') {
        for (x = 0; x < len; x++) {
            row = evt.rows[x];

            event = {
                pk: row[pk],
                table: tableName,
                schema: schemaName,
                item: row
            };

            if (self.onInsert) {
                if (self.onInsertWrapper) {
                    self.onInsertWrapper(function() {
                        self.onInsert(event, evt);
                    });
                } else {
                    self.onInsert(event, evt);
                }
            }

            if (self.onEvent) {
                if (self.onEventWrapper) {
                    self.onEventWrapper(function() {
                        self.onEvent(event, evt);
                    });
                } else {
                    self.onEvent(event, evt);
                }
            }

            self.emitInsert && self.emit('insert', event);

            if (self.emitEvent) {
                event.type = 'insert';
                self.emit('event', event);
            }
        }
    } else if (eventName === 'updaterows') {
        for (x = 0; x < len; x++) {
            row = evt.rows[x];

            event = {
                pk: row.after[pk],
                table: tableName,
                schema: schemaName,
                item: row.after
            };

            if (self.onUpdate) {
                if (self.onUpdateWrapper) {
                    self.onUpdateWrapper(function() {
                        self.onUpdate(event, evt);
                    });
                } else {
                    self.onUpdate(event, evt);
                }
            }

            if (self.onEvent) {
                if (self.onEventWrapper) {
                    self.onEventWrapper(function() {
                        self.onEvent(event, evt);
                    });
                } else {
                    self.onEvent(event, evt);
                }
            }

            self.emitUpdate && self.emit('update', event);

            if (self.emitEvent) {
                event.type = 'update';
                self.emit('event', event);
            }
        }
    }
};

MySql.prototype.start = function start(cb) {
    'use strict';

    var zongji = this.zongji,
        self = this;

    zongji.on('binlog', self._binLogHandler.bind(self));

    zongji.start({
        includeEvents: ['tablemap', 'writerows', 'updaterows', 'deleterows'],
        startAtEnd: true,
        serverId: self.serverId
    });

    zongji.ctrlConnection.on('connect', function(err) {
        cb && cb(err);

        setInterval(function() {
            self.test(function(err, results) {
                if (results) {
                    console.log(JSON.stringify(results));
                }
            });
        }, 30000);
    });
};

MySql.prototype.ping = function ping(cb) {
    var start = new Date().getTime(),
        host = this.zongji.ctrlConnection.config.host;

    this.zongji.ctrlConnection.ping(function(error) {;
        cb & cb(error, {
            latency: new Date().getTime() - start,
            connected: !!error,
            error: error,
            host: host
        });
    });
};

MySql.prototype.test = function test(cb) {
    var self = this,
        start,
        host = this.zongji.ctrlConnection.config.host,
        origEmitValue = self.emitEvent;

    this.zongji.ctrlConnection.query(
        'CREATE TABLE IF NOT EXISTS `lapidus`.`lapidus_healthcheck` (ID integer PRIMARY KEY, last_checked TIMESTAMP);',
        function(error) {
            if (error) {
                error.host = host;
                self.emitEvent = origEmitValue;
                return cb & cb(error, null);
            }

            start = new Date().getTime();

            self.emitEvent = true;

            self.zongji.ctrlConnection.query(
                'INSERT INTO `lapidus`.`lapidus_healthcheck` VALUES (' + process.pid + ', now()) ON DUPLICATE KEY UPDATE last_checked=now();',
                function(error) {
                    if (error) {
                        error.host = host;
                        self.emitEvent = origEmitValue;
                        return cb & cb(error, null);
                    }
                });

            function handler(event) {
                if (event.table === 'lapidus_healthcheck' && event.pk === process.pid) {

                    cb & cb(null, {
                        latency: new Date().getTime() - start,
                        connected: true,
                        error: error,
                        host: host
                    });

                    self.removeListener('event', handler);
                    self.emitEvent = origEmitValue;
                }
            }

            self.on('event', handler);
        }
    );
};

module.exports = MySql;