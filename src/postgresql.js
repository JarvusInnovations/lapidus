'use strict';

const util = require('util');
const EventEmitter = require('events');
const fs = require('fs');
const assert = require('assert');

/* TODO: Deprecate DatabaseTransaction as it is naive and will not work well with large transactions. If we flushed
         to disk and used streams throughout we could support this but it'd be difficult to apply filters and work with
         plugins.
*/
function DatabaseTransaction(txId) {
    this.txId = txId;
    this.stack = [];
}

DatabaseTransaction.prototype.push = function(event) {
    return this.stack.push(event);
};

DatabaseTransaction.prototype.commit = function commit(ts) {
    return this.event || (this.event = {
        items: this.stack,
        id: this.txId,
        ts: ts
    });
};

function PostgresLogicalReceiver(options) {
    var defaults = {
            host: null,
            port: null,
            user: null,
            password: null,
            database: null,
            env: {},
            populateEnv: true,
            timeout: 10000,
            decodingPlugin: 'jsoncdc',
            slot: null,
            debug: false,
            linePrefix: null,
            lineOffset: 0
        },
        self = this;

    options = options || {};

    this.currentTxId = null;
    this.schemaCache = {};

    for (var prop in defaults) {
        // Prevent passwords from appearing in errors/logs
        if (prop === 'password' || prop === 'env') {
            Object.defineProperty(this, prop, {
                value: typeof options[prop] === 'undefined' ? defaults[prop] : options[prop],
                enumerable: false,
                writable: true
            });
        } else {
            this[prop] = typeof options[prop] === 'undefined' ? defaults[prop] : options[prop];
        }
    }

    // TODO: Make a better transform function to normalize the difference in connection parameters between worker types
    if (this.populateEnv && Object.keys(this.env).length === 0) {
        ['host', 'port', 'database', 'user', 'password'].forEach(function (prop) {
            var val = self[prop];

            if (val !== null) {
                self.env['PG' + prop.toUpperCase()] = val;
            }
        });
    }

    // In V8 it's 8.7x slower to lookup an undefined property than to read a boolean value, so we'll explicitly set values.
    Object.defineProperty(this, "_emitEvents", {
        enumerable: false,
        writable: true
    });

    this._emitEvents = (typeof options.emitEvents === 'boolean') ? options.emitEvents : true;

    this.emitInsert            = (typeof options.emitInsert            === 'boolean')  ? options.emitInsert            : this._emitEvents;
    this.emitUpdate            = (typeof options.emitUpdate            === 'boolean')  ? options.emitUpdate            : this._emitEvents;
    this.emitDelete            = (typeof options.emitDelete            === 'boolean')  ? options.emitDelete            : this._emitEvents;
    this.emitSchema            = (typeof options.emitSchema            === 'boolean')  ? options.emitSchema            : this._emitEvents;
    this.emitTransaction       = (typeof options.emitTransaction       === 'boolean')  ? options.emitTransaction       : this._emitEvents;
    this.emitBeginTransaction  = (typeof options.emitBeginTransaction  === 'boolean')  ? options.emitBeginTransaction  : this._emitEvents;
    this.emitCommitTransaction = (typeof options.emitCommitTransaction === 'boolean')  ? options.emitCommitTransaction : this._emitEvents;
    this.emitEvent             = (typeof options.emitEvent             === 'boolean')  ? options.emitEvent             : this._emitEvents;

    this.onInsert            = (typeof options.onInsert            === 'function') ? options.onInsert            : false;
    this.onUpdate            = (typeof options.onUpdate            === 'function') ? options.onUpdate            : false;
    this.onDelete            = (typeof options.onDelete            === 'function') ? options.onDelete            : false;
    this.onSchema            = (typeof options.onSchema            === 'function') ? options.onSchema            : false;
    this.onTransaction       = (typeof options.onTransaction       === 'function') ? options.onTransaction       : false;
    this.onBeginTransaction  = (typeof options.onBeginTransaction  === 'function') ? options.onBeginTransaction  : false;
    this.onCommitTransaction = (typeof options.onCommitTransaction === 'function') ? options.onCommitTransaction : false;
    this.onEvent             = (typeof options.onEvent             === 'function') ? options.onEvent             : false;

    Object.defineProperty(this, "_onEventsWrapper", {
        enumerable: false,
        writable: true
    });

    this._onEventsWrapper = (typeof options.onEventsWrapper === 'function') ? options.onEventsWrapper : false;

    this.onInsertWrapper            = (typeof options.onInsertWrapper            === 'function') ? options.onInsertWrapper            : this._onEventsWrapper;
    this.onUpdateWrapper            = (typeof options.onUpdateWrapper            === 'function') ? options.onUpdateWrapper            : this._onEventsWrapper;
    this.onDeleteWrapper            = (typeof options.onDeleteWrapper            === 'function') ? options.onDeleteWrapper            : this._onEventsWrapper;
    this.onSchemaWrapper            = (typeof options.onSchemaWrapper            === 'function') ? options.onSchemaWrapper            : this._onEventsWrapper;
    this.onTransactionWrapper       = (typeof options.onTransactionWrapper       === 'function') ? options.onTransactionWrapper       : this._onEventsWrapper;
    this.onBeginTransactionWrapper  = (typeof options.onBeginTransactionWrapper  === 'function') ? options.onBeginTransactionWrapper  : this._onEventsWrapper;
    this.onCommitTransactionWrapper = (typeof options.onCommitTransactionWrapper === 'function') ? options.onCommitTransactionWrapper : this._onEventsWrapper;
    this.onEventWrapper             = (typeof options.onEventWrapper             === 'function') ? options.onEventWrapper             : this._onEventsWrapper;

    this.excludeTables = options.excludeTables || null;

    EventEmitter.call(this);
}

// This line must appear before anything is added to the PostgresLogicalReceiver prototype
util.inherits(PostgresLogicalReceiver, EventEmitter);

Object.defineProperty(PostgresLogicalReceiver.prototype, 'onEventsWrapper', {
    set: function (val) {
        val = (typeof val === 'function') ? val : false;

        this.onInsertWrapper            = (this.onInsertWrapper            === this._onEventsWrapper) ? val : this.onInsertWrapper;
        this.onDeleteWrapper            = (this.onDeleteWrapper            === this._onEventsWrapper) ? val : this.onDeleteWrapper;
        this.onUpdateWrapper            = (this.onUpdateWrapper            === this._onEventsWrapper) ? val : this.onUpdateWrapper;
        this.onSchemaWrapper            = (this.onSchemaWrapper            === this._onEventsWrapper) ? val : this.onSchemaWrapper;
        this.onTransactionWrapper       = (this.onTransactionWrapper       === this._onEventsWrapper) ? val : this.onTransactionWrapper;
        this.onBeginTransactionWrapper  = (this.onBeginTransactionWrapper  === this._onEventsWrapper) ? val : this.onBeginTransactionWrapper;
        this.onCommitTransactionWrapper = (this.onCommitTransactionWrapper === this._onEventsWrapper) ? val : this.onCommitTransactionWrapper;
        this.onEventWrapper             = (this.onEventWrapper             === this._onEventsWrapper) ? val : this.onEventWrapper;

        this._onEventsWrapper = val;
    },

    get: function () {
        return this._onEventsWrapper;
    }
});

Object.defineProperty(PostgresLogicalReceiver.prototype, 'emitEvents', {
    set: function (val) {
        this.emitInsert = val;
        this.emitUpdate = val;
        this.emitDelete = val;
        this.emitSchema = val;
        this.emitTransaction = val;
        this.emitBeginTransaction = val;
        this.emitCommitTransaction = val;
        this.emitEvent = val;

        this._emitEvents = val;
    },

    get: function () {
        return !!this._emitEvents;
    }
});

PostgresLogicalReceiver.prototype.createSlot = function createSlot(slot, callback) {
    // TODO: Implement createSlot
};

PostgresLogicalReceiver.prototype.dropSlot = function dropSlot(slot, callback) {
    // TODO: Implement dropSlot (note, this is/was not used internally in 1.x)
};

PostgresLogicalReceiver.prototype.stop = function stop(callback) {
    // TODO: Implement stop
};

PostgresLogicalReceiver.prototype.lineHandler = function lineHandler (line) {
    // TODO: Refactor to work with pgwire for 1.x branch
    var tableName,
        action,
        pk,
        msg,
        type,
        eventHandler,
        eventHandlerWrapper,
        emitEvent,
        transactionEvent,
        tableName = line.table,
        self = this;

    // HACK: Filter out pg_temp tables (if you refresh a materialized view you'll get an INSERT
    // for each row to a pg_temp_* table)
    if (tableName) {
        if (tableName.indexOf('pg_temp_') !== -1) {
            return;
        }

        if (self.excludeTables) {
            if (self.excludeTables.indexOf(tableName) !== -1) {
                return;
            }
        }
    }

    if (line.insert) {
        action = 'insert';
        eventHandler = 'onInsert';
        eventHandlerWrapper = 'onInsertWrapper';
        emitEvent = 'emitInsert';
    } else if (line.update) {
        action = 'update';
        eventHandler = 'onUpdate';
        eventHandlerWrapper = 'onUpdateWrapper';
        emitEvent = 'emitUpdate';
    } else if (line.delete) {
        action = 'delete';
        eventHandler = 'onDelete';
        eventHandlerWrapper = 'onDeleteWrapper';
        emitEvent = 'emitDelete';

        msg = {
            table: tableName,
            schema: self.schemaCache[tableName],
            item: line['@'],
            txId: self.currentTxId,
        };

        if (typeof line['@'] === 'object') {
            msg.pk = line['@'][Object.keys(line['@']).filter(key => line['@'][key] !== null).shift()] || null;
        }

        if (self.emitTransaction) {
            self.currentTx.push(msg);
        }
    } else if (line.schema) {
        action = 'schema';
        eventHandler = 'onSchema';
        eventHandlerWrapper = 'onSchemaWrapper';
        emitEvent = 'emitSchema';

        self.schemaCache[tableName] = line.schema;
    } else if (line.begin) {
        action = 'beginTransaction';
        eventHandler = 'onBeginTransaction';
        eventHandlerWrapper = 'onBeginTransactionWrapper';
        emitEvent = 'emitBeginTransaction';

        msg = {
            'id': line.begin
        };

        if (self.emitTransaction) {
            self.currentTxId = line.begin;
            self.currentTx = new DatabaseTransaction(self.currentTxId);
        }
    } else if (line.commit) {
        action = 'commitTransaction';
        eventHandler = 'onCommitTransaction';
        eventHandlerWrapper = 'onCommitTransactionWrapper';
        emitEvent = 'emitCommitTransaction';

        msg = {
            'id': line.commit,
            'timestamp': new Date(line.t)
        };

        if (self.emitTransaction) {
            assert.equal(self.currentTxId, line.commit, 'Mismatched currentTxId');
            transactionEvent = self.currentTx.commit(msg.timestamp);
        }
    } else {
        console.error(new Error('jsoncdc sent an unknown event type: ' + line));
        return;
    }

    if (!msg) {
        pk = line[action].id || line[action].ID;

        msg = {
            table: tableName,
            pk: pk,
            schema: self.schemaCache[tableName],
            item: (line[action] || pk),
            txId: self.currentTxId
        };

        if (self.emitTransaction) {
            self.currentTx.push(msg);
        }
    }

    if (transactionEvent) {
        if (self.emitTransaction) {
            self.emit('transaction', transactionEvent);    
        }

        if (self.onTransaction) {
            if (self.onTransactionWrapper) {
                self.onTransactionWrapper(function () {
                    self.onTransaction(transactionEvent, transactionEvent);
                });            
            } else {
                self.onTransaction(transactionEvent, transactionEvent);    
            }
        }
    }

    if (self[eventHandler]) {
        if (self[eventHandlerWrapper]) {
            self[eventHandlerWrapper](function () {
                self[eventHandler](msg, line);
            });
        } else {
            self[eventHandler](msg, line);
        }
    }

    self[emitEvent] && self.emit(action, msg);

    if (self.onEvent) {
        msg.type = action;

        if (transactionEvent) {
            transactionEvent.type = 'transaction';

            if (self.onEventWrapper) {
                self.onEventWrapper(function () {
                    self.onEvent(transactionEvent, line);
                });
            } else {
                self.onEvent(transactionEvent, transactionEvent);
            }
        }

        if (self.onEventWrapper) {
            self.onEventWrapper(function () {
                self.onEvent(msg, line);
            });
        } else {
            self.onEvent(msg, line);
        }
    }

    if (self.emitEvent) {
        msg.type = action;
        self.emit('event', msg);

        if (transactionEvent) {
            transactionEvent.type = 'transaction';
            self.emit('event', transactionEvent);
        }
    }
};

PostgresLogicalReceiver.prototype.start = function start(slot, callback) {
};    // TODO: Implement start

PostgresLogicalReceiver.prototype.init = function init(callback) {
    // TODO: Implement init
   callback();
};

PostgresLogicalReceiver.prototype.validateConfig = function validateConfig(config, globalConfig) {
    var errors = [];

    // TODO: We don't validate this right now because the user may have their environment setup to provide Postgres
    // connection details through its various mechanisms. If this is not the case the canPsql function will fail
    // and useful errors are generated. It may be advisable to call canPsql to validate the configuration, however,
    // a transient connection error doesn't equal a configuration error, however, failed auth or a database that does
    // not exist at launch likely can be classified as one.

    // TODO: Come up with a DRY pattern for configuration validation that can also work from the constructor when
    // used as a module

    if (typeof config.slot !== 'string') {
        errors.push('slot is required. see logical decoding documentation for details.')
    } else if (!/\w+/.test(config.slot)) {
        errors.push('slot can only contain letters, numbers and underscores. You passed: ' + config.slot);
    }

    return errors;
};

module.exports = PostgresLogicalReceiver;
