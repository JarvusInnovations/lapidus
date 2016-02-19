'use strict';

const util = require('util');
const EventEmitter = require('events');
const fs = require('fs');
const pgConfig = require('pg-config');
const exec = require('child_process').exec;
const execFile = require('child_process').execFile;
const spawn = require('child_process').spawn;
const async = require('async');

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
            decodingPlugin: 'decoding_json',
            slot: null,
            debug: false,
            linePrefix: null,
            lineOffset: 0
        },
        self = this;

    options = options || {};

    for (var prop in defaults) {
        // Prevent passwords from appearing in errors/logs
        if (prop === 'password' || prop == 'env') {
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

    // In V8 it's 8.7x slower to lookup an undefined property than to read a boolean value, so we'll explicitly values.

    Object.defineProperty(this, "_emitEvents", {
        enumerable: false,
        writable: true
    });

    this._emitEvents = (typeof options.emitEvents === 'boolean') ? options.emitEvents : true;

    this.emitInsert = (typeof options.emitInsert === 'boolean') ? options.emitInsert : this._emitEvents;
    this.emitUpdate = (typeof options.emitUpdate === 'boolean') ? options.emitUpdate : this._emitEvents;
    this.emitDelete = (typeof options.emitDelete === 'boolean') ? options.emitDelete : this._emitEvents;
    this.emitEvent =  (typeof options.emitEvent === 'boolean') ? options.emitEvent : this._emitEvents;

    this.onInsert = (typeof options.onInsert === 'function') ? options.onInsert : false;
    this.onUpdate = (typeof options.onUpdate === 'function') ? options.onUpdate : false;
    this.onDelete = (typeof options.onDelete === 'function') ? options.onDelete : false;
    this.onEvent =  (typeof options.onEvent === 'function') ? options.onEvent : false;

    Object.defineProperty(this, "_onEventsWrapper", {
        enumerable: false,
        writable: true
    });

    this._onEventsWrapper = (typeof options.onEventsWrapper === 'function') ? options.onEventsWrapper : false;

    this.onInsertWrapper = (typeof options.onInsertWrapper === 'function') ? options.onInsertWrapper : this._onEventsWrapper;
    this.onUpdateWrapper = (typeof options.onUpdateWrapper === 'function') ? options.onUpdateWrapper : this._onEventsWrapper;
    this.onDeleteWrapper = (typeof options.onDeleteWrapper === 'function') ? options.onDeleteWrapper : this._onEventsWrapper;
    this.onEventWrapper  = (typeof options.onEventWrapper === 'function')  ? options.onEventWrapper : this._onEventsWrapper;

    this.excludeTables = options.excludeTables || null;

    EventEmitter.call(this);
}

// This line must appear before anything is added to the PostgresLogicalReceiver prototype
util.inherits(PostgresLogicalReceiver, EventEmitter);

Object.defineProperty(PostgresLogicalReceiver.prototype, 'onEventsWrapper', {
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

Object.defineProperty(PostgresLogicalReceiver.prototype, 'emitEvents', {
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

function isExecutable(path, callback) {
    fs.stat(path, function (err, file) {
        if (!err && file && file.isFile()) {
            if (process.platform === 'win32') {
                return callback(null, true);
            }

            return callback(null, (file.mode & parseInt('0001', 8)) || (file.mode & parseInt('0010', 8)) &&
                process.getgid && file.gid === process.getgid() ||
                (file.mode & parseInt('0100', 8)) && process.getuid && file.uid === process.getuid());
        }

        return callback(new Error(path + ' is either missing or not executable'), false);
    });
}

PostgresLogicalReceiver.prototype.stdErrorToEvent = function stdErrorToEvent(line) {
    var linePrefix = this.linePrefix,
        lineOffset = this.lineOffset,
        str = line.substr(lineOffset).trim(),
        firstThree = str.substr(0, 3),
        eventType = 'error';

    if (line === '') {
        return;
    }

    if (firstThree === 'cou' || firstThree === 'unr' || firstThree === 'une' || firstThree === 'sel') {
        eventType = 'error';
    } else if (firstThree === 'con') {
        eventType = 'status';
    } else if (firstThree === 'sta') {
        eventType = 'status';
    } else if (firstThree === 'dis') {
        eventType = 'disconnected';
    } else if (str === 'streaming initiated') {
        eventType = 'status';
    } else if (str === 'streaming header too small') {
        eventType = 'error';
    } else {
        if (line.indexOf(linePrefix) !== 0 && line !== '') {
            this.debug && console.warn('Ignoring stderr (likely logging sent from server): ' + line);
        } else {
            this.debug && console.error('stderr with prefix fell through: ' + line);
        }
        return;
    }

    return {
        type: eventType,
        message: str.replace(linePrefix, '')
    };
};

PostgresLogicalReceiver.prototype.getLinePrefix = function getLinePrefix(callback) {
    var self = this;

    if (!this.binPath) {
        callback(new Error('You must call .init() before calling .getLinePrefix'), null);
    }

    if (this.linePrefix) {
        callback(null, this.linePrefix);
    }

    execFile(this.binPath + '/pg_recvlogical', [], {timeout: this.timeout},
        function (error, stdout, stderr) {

            if (error && stderr.indexOf('no slot specified') === -1) {
                return callback(new Error('Unexpected input from pg_recvlogical on stderr while parsing line prefix: ' + stderr), null);
            }

            stderr = stderr.split(':');

            self.linePrefix = stderr[0] + ': ';
            self.lineOffset = self.linePrefix.length;

            callback(null, stderr[0]);
        }
    );
};

PostgresLogicalReceiver.prototype.pgIsReady = function pgIsReady(callback) {
    if (!this.binPath) {
        callback(new Error('You must call .init() before calling .pgIsReady()'), null);
    }

    exec(this.binPath + '/pg_isready', {timeout: this.timeout}, function (error, stdout, stderr) {
        if (error) {
            return callback(new Error('pgIsReady Error: ' + stderr), false);
        }

        callback(null, stdout.indexOf('accepting connections') !== -1);
    });
};

PostgresLogicalReceiver.prototype.canPsql = function canPsql(callback) {
    if (!this.binPath) {
        callback(new Error('You must call .init() before calling .canPsql()'), null);
    }

    execFile(this.binPath + '/psql', ['-Atqwc', 'SELECT 1;'], {
        env: this.env,
        timeout: this.timeout
    }, function (error, stdout, stderr) {
        if (error) {
            return callback(new Error('canPsql Error: ' + stderr || error), false);
        }

        callback(null, stdout.indexOf('1') !== 0);
    });
};

PostgresLogicalReceiver.prototype.createSlot = function createSlot(slot, callback) {
    if (!this.binPath) {
        return callback(new Error('You must call .init() before calling .createSlot()'), null);
    }

    if (typeof slot === 'function') {
        callback = slot;
        slot = this.slot;
    }

    if (!slot) {
        return callback(new Error(".createSlot() requires a slot in the configuration or function arguments"), null);
    }


    execFile(this.binPath + '/pg_recvlogical', [
        '--slot=' + slot,
        '--create-slot',
        '--plugin=' + this.decodingPlugin,
        '--dbname=' + this.database,
    ], {
        env: this.env,
        timeout: this.timeout
    }, function (error, stdout, stderr) {
        if (error) {
            if (error.message.indexOf('already exists') === -1) {
                return callback(new Error('Failed to create slot: ' + stderr), false);
            }
        }

        callback(null, stdout);
    });
};

PostgresLogicalReceiver.prototype.dropSlot = function dropSlot(slot, callback) {
    if (!this.binPath) {
        return callback(new Error('You must call .init() before calling .dropSlot()'), null);
    }

    if (typeof slot === 'function') {
        callback = slot;
        slot = this.slot;
    }

    if (!slot) {
        return callback(new Error('.createSlot() requires a slot in the configuration or function arguments'), null);
    }

    execFile(this.binPath + '/pg_recvlogical', [
        '--slot=' + slot,
        '--drop-slot',
        '--dbname=' + this.database,
    ], {
        env: this.env,
        timeout: this.timeout
    }, function (error, stdout, stderr) {
        if (error) {
            return callback(new Error('Failed to drop slot: ' + stderr), false);
        }

        callback(null, stdout);
    });
};

PostgresLogicalReceiver.prototype.stop = function stop(callback) {
    if (this instanceof PostgresLogicalReceiver) {
        if (!this.binPath) {
            return callback && callback(new Error('You must call .init() before calling .stop()'), null);
        }

        if (!this.spawn) {
            return callback && callback(new Error('You must call .start() before calling .stop()'), null);
        }

        this.spawn.kill();
        process.off('exit', stop);
    } else if (callback && callback.message && callback.name) {
        this.emit('error', callback);
    }
};

PostgresLogicalReceiver.prototype.start = function start(slot, callback) {
    var pg_recvlogical,
        self = this;

    if (typeof slot === 'function') {
        callback = slot;
        slot = this.slot;
    }

    if (!slot) {
        return callback(new Error('.start() requires a slot in the configuration or function arguments'), null);
    }

    if (!this.binPath) {
        return callback && callback(new Error('You must call .init() before calling .start()'), null);
    }

    if (!this.spawn) {
        // TODO: Log level warning that start() was called twice
    }

    this.createSlot(slot, function (err) {
        if (err) {
            return callback(err);
        }


        self.spawn = pg_recvlogical = spawn(self.binPath + '/pg_recvlogical', [
            '--slot=' + slot,
            '--plugin=' + self.decodingPlugin,
            '--dbname=' + self.database,
            '--start',
            '-f-',
        ], {env: self.env, detached: false});

        process.on('exit', function() {
            // If the worker crashes, kill pg_recvlogical to avoid missing output
            if (self.spawn && typeof self.spawn.kill === 'function') {
                self.spawn.kill();
            }
        });

        pg_recvlogical.stdout.setEncoding('utf8');
        pg_recvlogical.stderr.setEncoding('utf8');

        pg_recvlogical.stderr.on('data', function (data) {
            data.split('\n').forEach(function (line) {
                var event = self.stdErrorToEvent(line);

                if (event) {
                    self.emit(event.type, event.message);
                }
            });
        });

        pg_recvlogical.stdout.on('data', function (data) {
            data.split('\n').forEach(function (line) {
                var tableName,
                    action,
                    pk,
                    msg,
                    type,
                    eventHandler,
                    eventHandlerWrapper,
                    emitEvent;

                if (line.charAt(0) === '{') {
                    try {
                        line = JSON.parse(line);

                        type = line.type;

                        if (type === 'table') {
                            tableName = line.name;

                            // HACK: Filter out pg_temp tables (if you refresh a materialized view you'll get an INSERT
                            // for each row to a pg_temp_xxxxxxx table)
                            if (tableName.substr(0, 8) === 'pg_temp_') {
                                return;
                            }

                            if (self.excludeTables) {
                                if (self.excludeTables.indexOf(tableName) !== -1) {
                                    return;
                                }
                            }

                            // SPEED HACK: Avoid concatenation, toLowerCase and Object lookup (6-8x boost)
                            if (line.change == 'INSERT') {
                                action = 'insert';
                                eventHandler = 'onInsert';
                                eventHandlerWrapper = 'onInsertWrapper';
                                emitEvent = 'emitInsert';
                            } else if (line.change == 'UPDATE') {
                                action = 'update';
                                eventHandler = 'onUpdate';
                                eventHandlerWrapper = 'onUpdateWrapper';
                                emitEvent = 'emitUpdate';
                            } else if (line.change == 'DELETE') {
                                action = 'delete';
                                eventHandler = 'onDelete';
                                eventHandlerWrapper = 'onDeleteWrapper';
                                emitEvent = 'emitDelete';
                            } else {
                                // The only value here would be FIX ME, which only happens if there's an error during
                                // logical encoding. We'll need to establish a way to provide to deal with this
                                // perhaps a pressure valve can be used to change from a warning to fatal
                                console.error(new Error('decoding_json failed to logically decode a line: ' + line));
                                return;
                            }

                            // TODO: decoding_json doesn't seem to send the keys on INSERT, only on update
                            pk = line.key ? line.key[Object.keys(line.key)[0]] : line.data.id || line.data.ID;

                            msg = {
                                table: tableName,
                                pk: pk,
                                schema: line.schema,
                                item: (line.data || pk)
                            };

                            if (self[eventHandler]) {
                                if (self[eventHandlerWrapper]) {
                                    self[eventHandlerWrapper](function() {
                                        self[eventHandler](msg, line);
                                    });
                                } else {
                                    self[eventHandler](msg, line);
                                }
                            }

                            self[emitEvent] && self.emit(action, msg);

                            if (self.onEvent) {
                                msg.type = action;

                                if (self.onEventWrapper) {
                                    self.onEventWrapper(function() {
                                        self.onEvent(msg, line);
                                    });
                                } else {
                                    self.onEvent(msg, line);
                                }
                            }

                            if (self.emitEvent) {
                                msg.type = action;
                                self.emit('event', msg);
                            }
                        }
                    } catch (e) {
                        self.emit('error', e + line);
                        self.debug && console.error('PostgreSQL: ' + e);
                        self.debug && console.error('PostgreSQL: ' + line);
                    }
                }
            });
        });

        pg_recvlogical.on('close', function (code) {
            self.emit((code === 0) ? 'stop' : 'error', 'pg_recvlogical exited with code: ' + code);
        });

        callback(null, pg_recvlogical);
    });
};

PostgresLogicalReceiver.prototype.init = function init(callback) {
    var self = this;

    async.auto({
        pg_config: function (cb) {
            pgConfig.getConfig(function (err, config) {
                if (err) {
                    return cb(err, null);
                }

                self.binPath = config.paths.bin;

                cb(null, config);
            });
        },

        pg_isready: ['pg_config', function (cb) {
            isExecutable(self.binPath + '/pg_isready', function (err, executable) {
                if (err || !executable) {
                    cb(new Error(self.binPath + '/pg_isready is missing or not executable'), false);
                }

                cb(null, true);
            });
        }],

        pg_recvlogical: ['pg_config', function (cb) {
            isExecutable(self.binPath + '/pg_recvlogical', function (err, executable) {
                if (err || !executable) {
                    cb(new Error(self.binPath + '/pg_recvlogical is missing or not executable'), false);
                }

                cb(null, true);
            });
        }],

        psql: ['pg_config', function (cb) {
            isExecutable(self.binPath + '/psql', function (err, executable) {
                if (err || !executable) {
                    cb(new Error(self.binPath + '/psql is missing or not executable'), false);
                }

                cb(null, true);
            });
        }],

        linePrefix: ['pg_recvlogical', function (cb) {
            self.getLinePrefix(cb);
        }],

        canPsql: ['pg_config', function (cb) {
            self.canPsql(cb);
        }]

    }, function (err, results) {
        callback && callback(err, self);
    });
};

PostgresLogicalReceiver.prototype.validateConfig = function validateConfig(config, globalConfig) {
    var errors = [];

    // TODO: We don't validate this right now because the user may have their environment setup to provide Postgres
    // connection details through its various mechanisms. If this is not the case the canPsql function will fail
    // and useful errors are generated. It may be advisable to call canPsql to validate the configuration, however,
    // a transient connection error doesn't equal a configuration errors, however, failed auth or a database that does
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