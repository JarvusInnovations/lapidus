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
            slotName: 'lapidus_test1',
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

    if (this.populateEnv && Object.keys(this.env).length === 0) {
        ['host', 'port', 'database', 'user', 'password'].forEach(function(prop) {
            var val = self[prop];

            if (val !== null) {
                self.env['PG' + prop.toUpperCase()] = val;
            }
        });
    }

    EventEmitter.call(this);
}

// This line must appear before anything is added to the PostgresLogicalReceiver prototype
util.inherits(PostgresLogicalReceiver, EventEmitter);

function isExecutable(path, callback) {
    fs.stat(path, function(err, file) {
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
    } else if (firstThree ==='dis') {
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

    execFile(this.binPath + '/pg_recvlogical', [], { timeout: this.timeout },
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

    exec(this.binPath + '/pg_isready', { timeout: this.timeout }, function(error, stdout, stderr) {
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

    execFile(this.binPath + '/psql', ['-Atqwc', 'SELECT 1;'], { env: this.env, timeout: this.timeout }, function(error, stdout, stderr) {
        if (error) {
            return callback(new Error('canPsql Error: ' + stderr), false);
        }

        callback(null, stdout.indexOf('1') !== 0);
    });
};

PostgresLogicalReceiver.prototype.createSlot = function createSlot(slotName, callback) {
    if (!this.binPath) {
        return callback(new Error('You must call .init() before calling .createSlot()'), null);
    }

    if (typeof slotName === 'function') {
        callback = slotName;
        slotName = this.slotName;
    }

    if (!slotName) {
        return callback(new Error(".createSlot() requires a slotName in the configuration or function arguments"), null);
    }


    execFile(this.binPath + '/pg_recvlogical', [
            '--slot=' + slotName,
            '--if-not-exists',
            '--create-slot',
            '--plugin=' + this.decodingPlugin,
            '--dbname=' + this.database,
        ], {
            env: this.env,
            timeout: this.timeout
        }, function (error, stdout, stderr) {
            if (error) {
                return callback(new Error('Failed to create slot: ' + stderr), false);
            }

            callback(null, stdout);
    });
};

PostgresLogicalReceiver.prototype.dropSlot = function dropSlot(slotName, callback) {
    if (!this.binPath) {
       return callback(new Error('You must call .init() before calling .dropSlot()'), null);
    }

    if (typeof slotName === 'function') {
        callback = slotName;
        slotName = this.slotName;
    }

    if (!slotName) {
        return callback(new Error('.createSlot() requires a slotName in the configuration or function arguments'), null);
    }

    execFile(this.binPath + '/pg_recvlogical', [
            '--slot=' + slotName,
            '--if-not-exists',
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

        process.off('uncaughtException', this.stop);
        process.off('SIGINT', this.stop);
        process.off('SIGTERM', this.stop);

        this.spawn.kill();
    } else if (callback && callback.message && callback.name) {
        this.emit('error', callback);
    }
};

PostgresLogicalReceiver.prototype.start = function start(slotName, callback) {
    var pg_recvlogical,
        self = this;

    if (typeof slotName === 'function') {
        callback = slotName;
        slotName = this.slotName;
    }

    if (!slotName) {
        return callback(new Error('.createSlot() requires a slotName in the configuration or function arguments'), null);
    }

    if (!this.binPath) {
        return callback && callback(new Error('You must call .init() before calling .stop()'), null);
    }

    if (!this.spawn) {
        // TODO: Log level warning that start() was called twice
    }

    process.on('uncaughtException', this.stop);
    process.on('SIGINT', this.stop);
    process.on('SIGTERM', this.stop);

    pg_recvlogical = spawn(this.binPath + '/pg_recvlogical', [
        '--slot=' + slotName,
        '--if-not-exists',
        '--plugin=' + this.decodingPlugin,
        '--dbname=' + this.database,
        '--start',
        '-f-',
        ], { env: this.env });

    pg_recvlogical.stdout.setEncoding('utf8');
    pg_recvlogical.stderr.setEncoding('utf8');

    pg_recvlogical.stderr.on('data', function (data) {
        data.split('\n').forEach(function (line) {
            var event = self.stdErrorToEvent(line, self.linePrefix);

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
                room,
                type;

            if (line.charAt(0) === '{') {
                try {
                    line = JSON.parse(line);

                    type = line.type;

                    if (type === 'table') {
                        tableName = line.name;
                        action = line.change.toLowerCase();
                        pk = line.key ? line.key[Object.keys(line.key)[0]] : null,
                        msg = {
                            channel: tableName + (pk ? ':' + pk : ''),
                            type: action,
                            item: (line.data || pk)
                        };

                        self.debug && console.log(room + ':');
                        self.debug && console.log(msg);

                        self.emit('message', msg);
                    }
                } catch (e) {
                    self.emit('error', e);
                    self.debug && console.error(e);
                    self.debug && console.error(line);
                }
            }
        });
    });

    pg_recvlogical.on('close', function (code) {
        self.emit((code === 0) ? 'stop' : 'error', 'pg_recvlogical exited with code: ' + code);
    });

    this.spawn = pg_recvlogical;

    callback(null, pg_recvlogical);
};

PostgresLogicalReceiver.prototype.init = function init(callback) {
    var self = this;

    async.auto({
        pg_config: function(cb) {
           pgConfig.getConfig(function(err, config) {
               if (err) {
                   return cb(err, null);
               }

               self.binPath = config.paths.bin;

               cb(null, config);
           });
        },

        pg_isready: ['pg_config', function(cb) {
            isExecutable(self.binPath + '/pg_isready', function(err, executable) {
                if (err || !executable) {
                    cb(new Error(self.binPath + '/pg_isready is missing or not executable'), false);
                }

                cb(null, true);
            });
        }],

        pg_recvlogical: ['pg_config', function(cb) {
            isExecutable(self.binPath + '/pg_recvlogical', function(err, executable) {
                if (err || !executable) {
                    cb(new Error(self.binPath + '/pg_recvlogical is missing or not executable'), false);
                }

                cb(null, true);
            });
        }],

        psql: ['pg_config', function(cb){
            isExecutable(self.binPath + '/psql', function(err, executable) {
                if (err || !executable) {
                    cb(new Error(self.binPath + '/psql is missing or not executable'), false);
                }

                cb(null, true);
            });
        }],

        linePrefix: ['pg_recvlogical', function (cb) {
           self.getLinePrefix(cb);
        }],

        canPsql: ['pg_config', function(cb) {
          self.canPsql(cb);
        }]

    }, function(err, results) {
        callback && callback(err, self);
    });
};

module.exports = PostgresLogicalReceiver;