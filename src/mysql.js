var EventEmitter = require('events').EventEmitter,
    ZongJi = require('zongji');

function MySql(cfg) {
    'use strict';

    this.zongji = new ZongJi({
        host: cfg.hostname,
        user: cfg.username,
        password: cfg.password
    });

    this.serverId = cfg.serverId || (++MySql.prototype.serverId);

    EventEmitter.call(this);

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

    this.onInsert = (typeof cfg.onInsert === 'function') ? cfg.onInsert : false;
    this.onUpdate = (typeof cfg.onUpdate === 'function') ? cfg.onUpdate : false;
    this.onDelete = (typeof cfg.onDelete === 'function') ? cfg.onDelete : false;
    this.onEvent =  (typeof cfg.onEvent === 'function') ? cfg.onEvent : false;

    Object.defineProperty(this, "_onEventsWrapper", {
        enumerable: false,
        writable: true
    });

    this._onEventsWrapper = (typeof cfg.onEventsWrapper === 'function') ? cfg.onEventsWrapper : false;

    this.onInsertWrapper = (typeof cfg.onInsertWrapper === 'function') ? cfg.onInsertWrapper : this._onEventsWrapper;
    this.onUpdateWrapper = (typeof cfg.onUpdateWrapper === 'function') ? cfg.onUpdateWrapper : this._onEventsWrapper;
    this.onDeleteWrapper = (typeof cfg.onDeleteWrapper === 'function') ? cfg.onDeleteWrapper : this._onEventsWrapper;
    this.onEventWrapper  = (typeof cfg.onEventWrapper === 'function')  ? cfg.onEventWrapper : this._onEventsWrapper;

    this.schemaTablePrimaryKeys = cfg.schemaTablePrimaryKeys || {};
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

MySql.prototype.getPrimaryKeys = function getPrimaryKeys(schema, table, cb) {
    'use strict';

    var searchQuery = "t.TABLE_SCHEMA != 'mysql'";

    // Swizzle parameters
    if (typeof schema === 'function') {
        cb = schema;
        schema = null;
        table = null;
    } else if (typeof table === 'function') {
        cb = table;
        table = null;
    }

    if (schema) {
        searchQuery = `t.TABLE_SCHEMA = '${schema}'`;
    }

    if (table) {
        searchQuery += ` AND t.TABLE_NAME = '${table}'`;
    }

    this.zongji.ctrlConnection.query(`
        SELECT t.TABLE_SCHEMA AS 'schema',
               t.TABLE_NAME AS 'table',
               k.COLUMN_NAME AS 'column'
          FROM information_schema.TABLE_CONSTRAINTS t
          JOIN information_schema.KEY_COLUMN_USAGE k
         USING (CONSTRAINT_NAME, TABLE_SCHEMA, TABLE_NAME)
         WHERE t.CONSTRAINT_TYPE = 'PRIMARY KEY' AND ${searchQuery}`,
        function (err, pks) {
            if (err) {
                return cb && cb(err, null);
            }

            console.log('MySQL: Found ' + pks.length + ' primary keys... caching for fast lookups');

            cb && cb(err, pks);
        });
};

MySql.prototype.updatePrimaryKeys = function (schema, table, cb) {
    var self = this;

    self.updatePrimaryKeys.pending = true;

    self.getPrimaryKeys(schema, table, function (err, pks) {

        if (err) {
            if (!cb) {
                console.error(err);
            } else {
                cb(err);
            }
            self.updatePrimaryKeys.pending = false;
            return;
        }

        pks.forEach(function (pk) {
            self.schemaTablePrimaryKeys[pk.schema] = self.schemaTablePrimaryKeys[pk.schema] || {};
            self.schemaTablePrimaryKeys[pk.schema][pk.table] = pk.column;
        });

        self.updatePrimaryKeys.pending = false;
        cb && cb(err);
    });
};

MySql.prototype._binLogHandler = function _binLogHandler(evt) {
    var self = this,
        eventName = evt.getEventName(),
        tableName = evt.tableMap[evt.tableId].tableName,
        schemaName = evt.tableMap[evt.tableId].parentSchema,
        pk, row, len, x, event;

    if (eventName === 'tablemap') {
        if (!self.schemaTablePrimaryKeys[schemaName]) {
            self.schemaTablePrimaryKeys[schemaName] = {};
            console.log(`MySql: Encountered a newly created schema fetching PKs for all tables in:  ${schemaName}`);
            self.updatePrimaryKeys(schemaName);
        } else if (typeof self.schemaTablePrimaryKeys[schemaName][tableName] === 'undefined') {
            console.log(`MySql: Encountered a newly created table in ${schemaName} fetching PKs for: ${tableName}`);
            // Differentiate between newly created tables versus old tables without a primary key
            self.schemaTablePrimaryKeys[schemaName][tableName] = null;
            self.updatePrimaryKeys(schemaName, tableName);
        }
        return;
    }

    // TODO: Events for newly created tables with PK may not behave properly unless we can pause the queue or backlog
    // events until the PK is set by the code block above.

    pk = self.schemaTablePrimaryKeys[schemaName][tableName];
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

    self.updatePrimaryKeys(function (err) {
        if (err) {
            throw err;
        }

        zongji.start({
            includeEvents: ['tablemap', 'writerows', 'updaterows', 'deleterows'],
            startAtEnd: true,
            serverId: self.serverId
        });

        cb && cb(null);
    });
};

module.exports = MySql;