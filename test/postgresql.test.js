var assert = require('assert'),
    PostgreSql = require('../src/postgresql.js'),
    spawnSync = require('child_process').spawnSync,
    fs = require('fs'),
    path = require('path'),
    pg = require('pg');

describe('PostgreSQL', function () {
    var output,
        config = require(path.join(__dirname, './config/postgresql-only.json')).backends[0],
        publicProperties = [
            'onInsert',
            'onUpdate',
            'onDelete',
            'onEvent',
            'onError',
            'onTransaction',
            'onBeginTransaction',
            'onCommitTransaction',

            'onEventsWrapper',
            'onEventWrapper',
            'onInsertWrapper',
            'onUpdateWrapper',
            'onDeleteWrapper',
            'onSchemaWrapper',
            'onTransactionWrapper',
            'onBeginTransactionWrapper',
            'onCommitTransactionWrapper',

            'emitEvents',
            'emitDelete',
            'emitInsert',
            'emitUpdate',
            'emitError',
            'emitSchema',
            'emitBeginTransaction',
            'emitCommitTransaction'
        ],
        postgresql,
        client;

    before(function (done) {
        output = spawnSync('node', ['index.js', '-c', './test/config/postgresql-only.json'], {timeout: 1500});
        done();
    });

    it('connects to valid backends', function () {
        assert.equal(output.stderr.toString(), '');
        assert.equal(output.status, 0);
    });

    if (!process.env.CI) {
        before(function (done) {
            this.timeout(5000);
            output = spawnSync('psql', ['-f', './test/sql/postgresql_setup.sql'], {timeout: 5000});
            assert.equal(output.stderr.toString(), '');
            assert.equal(output.status, 0);
            done();
        });
    }

    it('node established a client connection to generate events using the pg library', function (done) {
        client = new pg.Client(config);

        client.connect(function (err) {
            done(err);
        })
    });

    describe('Can be used as a module', function () {
        var eventsWrapper;

        before(function (done) {
            // The slot will still be in use from the spawned process above
            config.slot = config.slot + '1';

            config.onEventsWrapper = setImmediate;

            config.onEvent = function () {
                console.log('onEvent');
                console.log(arguments);
            };

            postgresql = new PostgreSql(config);

            postgresql.init(function (err) {
                assert.ifError(err);

                postgresql.start(function (err) {
                    assert.ifError(err);
                    done();
                });
            });

            eventsWrapper = function eventsWrapper() {
                return 1 + 1;
            };
        });

        it('with meta properties that cascade properly to their children', function () {
            postgresql.onEventsWrapper = eventsWrapper;
            assert.equal(postgresql.onEventWrapper, eventsWrapper);
            assert.equal(postgresql.onInsertWrapper, eventsWrapper);
            assert.equal(postgresql.onUpdateWrapper, eventsWrapper);
            assert.equal(postgresql.onDeleteWrapper, eventsWrapper);
            assert.equal(postgresql.onSchemaWrapper, eventsWrapper);
            assert.equal(postgresql.onTransactionWrapper, eventsWrapper);
            assert.equal(postgresql.onBeginTransactionWrapper, eventsWrapper);
            assert.equal(postgresql.onCommitTransactionWrapper, eventsWrapper);

        });

        it('with meta properties that will only cascade valid values', function () {
            postgresql.onEventsWrapper = 'Not a function';
            assert.equal(postgresql.onEventWrapper, false);
            assert.equal(postgresql.onInsertWrapper, false);
            assert.equal(postgresql.onUpdateWrapper, false);
            assert.equal(postgresql.onDeleteWrapper, false);
            assert.equal(postgresql.onSchemaWrapper, false);
            assert.equal(postgresql.onTransactionWrapper, false);
            assert.equal(postgresql.onBeginTransactionWrapper, false);
            assert.equal(postgresql.onCommitTransactionWrapper, false);
        });

        it('with meta properties that will not overwrite custom values with meta values', function () {
            function otherFunc() {
                return 1 + 1;
            }

            function emptyFunc() {
                return;
            }

            postgresql.onInsertWrapper = otherFunc;
            postgresql.onEventsWrapper = emptyFunc;

            assert.equal(postgresql.onEventWrapper, emptyFunc);
            assert.equal(postgresql.onEventWrapper, emptyFunc);
            assert.equal(postgresql.onInsertWrapper, otherFunc, 'custom value should not be overridden by meta value');
            assert.equal(postgresql.onUpdateWrapper, emptyFunc);
            assert.equal(postgresql.onSchemaWrapper, emptyFunc);
            assert.equal(postgresql.onTransactionWrapper, emptyFunc);
            assert.equal(postgresql.onBeginTransactionWrapper, emptyFunc);
            assert.equal(postgresql.onCommitTransactionWrapper, emptyFunc);
        });

        it('with all publicly documented properties accessible', function () {
            var expectedProperties = [
                'onInsert',
                'onUpdate',
                'onDelete',
                'onEvent',
                'onTransaction',
                'onBeginTransaction',
                'onCommitTransaction',

                'onEventsWrapper',
                'onEventWrapper',
                'onInsertWrapper',
                'onUpdateWrapper',
                'onDeleteWrapper',
                'onSchemaWrapper',
                'onTransactionWrapper',
                'onBeginTransactionWrapper',
                'onCommitTransactionWrapper',

                'emitEvents',
                'emitDelete',
                'emitInsert',
                'emitUpdate',
                'emitTransaction',
                'emitBeginTransaction',
                'emitCommitTransaction'
            ];

            expectedProperties.forEach(function (prop) {
                assert.notEqual(postgresql[prop], undefined, prop + ' should be exposed.');
            });
        });

        it('setting emitEvents cascades', function () {
            postgresql.emitEvents = true;
            assert.equal(postgresql.emitEvent, true);
            assert.equal(postgresql.emitUpdate, true);
            assert.equal(postgresql.emitInsert, true);
            assert.equal(postgresql.emitDelete, true);
            assert.equal(postgresql.emitTransaction, true);
            assert.equal(postgresql.emitBeginTransaction, true);
            assert.equal(postgresql.emitCommitTransaction, true);

            postgresql.emitEvents = false;
            assert.equal(postgresql.emitEvent, false);
            assert.equal(postgresql.emitUpdate, false);
            assert.equal(postgresql.emitInsert, false);
            assert.equal(postgresql.emitDelete, false);
            assert.equal(postgresql.emitSchema, false);
            assert.equal(postgresql.emitTransaction, false);
            assert.equal(postgresql.emitBeginTransaction, false);
            assert.equal(postgresql.emitCommitTransaction, false);
        });

        it('allows all public properties to be nulled', function() {
            publicProperties.forEach(function(prop) {
                if (prop.indexOf('on') === 0) {
                    postgresql[prop] = null;
                } else {
                    postgresql[prop] = true;
                }
            });
        });

        describe('to stream insert events', function() {
            beforeEach(function(done) {
                var sql = `
                    INSERT INTO test_table
                                (first_name, last_name, sex, dob, nullable)
                            VALUES ('Frank', 'Lapidus', 'M','1952-11-29T12:34:56.000Z', null) RETURNING *;
                    `;

                client.query(sql, function (err, result) {
                    assert.ifError(err);
                    done();
                });
            });

            it('emits an "event" event', function(done) {
                function handler(evt) {
                    assert.equal(evt.type, 'beginTransaction');
                    assert.equal(typeof evt.id, 'number');
                    done();
                }

                postgresql.once('event', handler);
            });

            it('executes an onEvent handler', function(done) {
                postgresql.onEvent = function (evt) {
                    assert.equal(typeof evt.id, 'number');
                    assert.equal(evt.type, 'beginTransaction');
                    postgresql.onEvent = null;
                    done();
                };
            });

            it('emits an "insert" event', function(done) {
                function handler(evt) {
                    assert.equal(evt.item.id, 3);
                    done();
                }

                postgresql.once('insert', handler);
            });

            it('executes an onInsert handler', function(done) {
                postgresql.onInsert = function (evt) {
                    assert.equal(evt.item.id, 4);
                    postgresql.onInsert = null;
                    done();
                };
            });
        });
    });

    describe('to stream update events', function() {
        var id = 0;

        beforeEach(function(done) {
            var sql = `UPDATE test_table SET first_name = 'Rick', last_name = 'Sanchez' WHERE id = ${++id};`;

            client.query(sql, function (err, result) {
                assert.ifError(err);
                done();
            });
        });

        it('emits an "event" event', function(done) {
            function handler(evt) {
                assert.equal(evt.type, 'beginTransaction');
                assert.equal(typeof evt.id, 'number');
                done();
            }

            postgresql.once('event', handler);
        });

        it('executes an onEvent handler', function(done) {
            postgresql.onEvent = function (evt) {
                assert.equal(typeof evt.id, 'number');
                assert.equal(evt.type, 'beginTransaction');
                postgresql.onEvent = null;
                done();
            };
        });

        it('emits an "update" event', function(done) {
            function handler(evt) {
                assert.equal(evt.item.id, 3);
                done();
            }

            postgresql.once('update', handler);
        });

        it('executes an onUpdate handler', function(done) {
            postgresql.onUpdate = function (evt) {
                assert.equal(evt.item.id, 4);
                postgresql.onUpdate = null;
                done();
            };
        });
    });

    describe('to stream delete events', function() {
        var id = 0;

        beforeEach(function(done) {
            var sql = `DELETE FROM test_table WHERE id = ${++id};`;

            client.query(sql, function (err, result) {
                assert.ifError(err);
                done();
            });
        });

        it('emits an "event" event', function(done) {
            function handler(evt) {
                assert.equal(evt.type, 'beginTransaction');
                assert.equal(typeof evt.id, 'number');
                done();
            }

            postgresql.once('event', handler);
        });

        it('executes an onEvent handler', function(done) {
            postgresql.onEvent = function (evt) {
                assert.equal(typeof evt.id, 'number');
                assert.equal(evt.type, 'beginTransaction');
                postgresql.onEvent = null;
                done();
            };
        });

        it('emits a "delete" event', function(done) {
            function handler(evt) {
                assert.equal(evt.pk, 3);
                assert.equal(evt.item.id, 3);
                done();
            }

            postgresql.once('delete', handler);
        });

        it('executes an onDelete handler', function(done) {
            postgresql.onDelete = function (evt) {
                assert.equal(evt.pk, 4);
                assert.equal(evt.item.id, 4);
                postgresql.onDelete = null;
                done();
            };
        });
    });

    describe('to stream transaction events', function() {
        var id = 0;

        beforeEach(function(done) {
            var sql = `BEGIN TRANSACTION;

                        INSERT INTO test_table
                                (first_name, last_name, sex, dob, nullable)
                            VALUES ('Transaction', 'Man', 'M','1952-11-29T12:34:56.000Z', null);
                            
                        UPDATE test_table
                           SET first_name = 'Ricky',
                               last_name = 'Sanchez'
                         WHERE first_name = 'Transaction'
                           AND last_name = 'Man';

                        DELETE FROM test_table WHERE first_name = 'Ricky' AND last_name = 'Sanchez';
                        
                        COMMIT;`;

            client.query(sql, function (err, result) {
                assert.ifError(err);
                done();
            });
        });

        it('emits an "event" event', function(done) {
            function handler(evt) {
                assert.equal(evt.type, 'beginTransaction');
                assert.equal(typeof evt.id, 'number');
                done();
            }

            postgresql.once('event', handler);
        });

        it('executes an onEvent handler', function(done) {
            postgresql.onEvent = function (evt) {
                assert.equal(typeof evt.id, 'number');
                assert.equal(evt.type, 'beginTransaction');
                postgresql.onEvent = null;
                done();
            };
        });

        it('emits a "transaction" event', function(done) {
            function handler(evt) {
                assert(Array.isArray(evt.items), 'items in an array');
                done();
            }

            postgresql.once('transaction', handler);
        });

        it('executes a onTransaction handler', function(done) {
            postgresql.onTransaction = function (evt) {
                var idEvents,
                    id;
                assert(Array.isArray(evt.items), 'items is an array');
                idEvents = evt.items.filter(evt => evt.item.id !== undefined);
                id = idEvents[0].item.id;
                assert(idEvents.every(evt => evt.item.id === id), 'mismatched row id');
                assert.equal(idEvents[0].type, 'insert');
                assert.equal(idEvents[1].type, 'update');
                assert.equal(idEvents[2].type, 'delete');
                postgresql.onTransaction = null;
                done();
            };
        });
    });

    describe('jsoncdc properly handles built-in PostgreSQL data types', function () {

        // These are extracted using a jQuery snippet from the official documentation:
        // https://gist.github.com/jmealo/d1ae63bc61976af80b50
        var builtInTypes = {
                'bigint': {
                    name: 'bigint',
                    alias: 'int8',
                    description: 'signed eight-byte integer',
                    'tests': [{
                        input: Number.MAX_SAFE_INTEGER,
                        output: Number.MAX_SAFE_INTEGER
                    }]
                },
                'bigserial': {
                    name: 'bigserial',
                    alias: 'serial8',
                    description: 'autoincrementing eight-byte integer',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'bit(2)': {
                    name: 'bit(2)',
                    description: 'fixed-length bit string',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'bit varying(2)': {
                    name: 'bit varying(2)',
                    alias: 'varbit',
                    description: 'variable-length bit string',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'boolean': {
                    name: 'boolean',
                    alias: 'bool',
                    description: 'logical Boolean (true/false)',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'box': {
                    name: 'box',
                    description: 'rectangular box on a plane',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'bytea': {
                    name: 'bytea',
                    description: 'binary data ("byte array")',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'character(2)': {
                    name: 'character(2)',
                    alias: 'char(2)',
                    description: 'fixed-length character string',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },
                'character varying(2)': {
                    name: 'character varying(2)',
                    alias: 'varchar(2)',
                    description: 'variable-length character string',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'cidr': {
                    name: 'cidr',
                    description: 'IPv4 or IPv6 network address',
                    tests: [{
                        input: '192.168.100.128/25',
                        output: '192.168.100.128/25'
                    }]
                },

                'circle': {
                    name: 'circle',
                    description: 'circle on a plane',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'date': {
                    name: 'date',
                    description: 'calendar date (year, month, day)',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'double precision': {
                    name: 'double precision',
                    alias: 'float8',
                    description: 'double precision floating-point number (8 bytes)',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'inet': {
                    name: 'inet',
                    description: 'IPv4 or IPv6 host address',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },
                'integer': {
                    name: 'integer',
                    alias: 'int, int4',
                    description: 'signed four-byte integer',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'interval [ fields ] [ (p) ]': {
                    name: 'interval [ fields ] [ (p) ]',
                    description: 'time span',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'json': {
                    name: 'json',
                    description: 'textual JSON data',
                    tests: [{
                        input: {"howdy": "partner"},
                        output: {"howdy": "partner"}
                    }]
                },

                'jsonb': {
                    name: 'jsonb',
                    description: 'binary JSON data, decomposed',
                    tests: [{
                        input: {"howdy": "partner"},
                        output: {"howdy": "partner"}
                    }]
                },

                'line': {
                    name: 'line',
                    description: 'infinite line on a plane',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'lseg': {
                    name: 'lseg',
                    description: 'line segment on a plane',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'macaddr': {
                    name: 'macaddr',
                    description: 'MAC (Media Access Control) address',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'money': {
                    name: 'money',
                    description: 'currency amount',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'numeric [ (p, s) ]': {
                    name: 'numeric [ (p, s) ]',
                    alias: 'decimal [ (p, s) ]',
                    description: 'exact numeric of selectable precision',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'path': {
                    name: 'path',
                    description: 'geometric path on a plane',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'pg_lsn': {
                    name: 'pg_lsn',
                    description: 'PostgreSQL Log Sequence Number',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'point': {
                    name: 'point',
                    description: 'geometric point on a plane',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'polygon': {
                    name: 'polygon',
                    description: 'closed geometric path on a plane',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'real': {
                    name: 'real',
                    alias: 'float4',
                    description: 'single precision floating-point number (4 bytes)',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'smallint': {
                    name: 'smallint',
                    alias: 'int2',
                    description: 'signed two-byte integer',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'smallserial': {
                    name: 'smallserial',
                    alias: 'serial2',
                    description: 'autoincrementing two-byte integer',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'serial': {
                    name: 'serial',
                    alias: 'serial4',
                    description: 'autoincrementing four-byte integer',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'text': {
                    name: 'text',
                    description: 'variable-length character string',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'time [ (p) ] [ without time zone\n          ]': {
                    name: 'time [ (p) ] [ without time zone ]',
                    description: 'time of day (no time zone)',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'time [ (p) ] with time zone': {
                    name: 'time [ (p) ] with time zone',
                    alias: 'timetz',
                    description: 'time of day, including time zone',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'timestamp [ (p) ] [ without time zone ]': {
                    name: 'timestamp [ (p) ] [ without time zone ]',
                    description: 'date and time (no time zone)',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'timestamp [ (p) ] with time zone': {
                    name: 'timestamp [ (p) ] with time zone',
                    alias: 'timestamptz',
                    description: 'date and time, including time zone',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'tsquery': {
                    name: 'tsquery',
                    description: 'text search query',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'tsvector': {
                    name: 'tsvector',
                    description: 'text search document',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'txid_snapshot': {
                    name: 'txid_snapshot',
                    description: 'user-level transaction ID snapshot',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'uuid': {
                    name: 'uuid',
                    description: 'universally unique identifier',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                },

                'xml': {
                    name: 'xml',
                    description: 'XML data',
                    tests: [{
                        input: '',
                        output: ''
                    }]
                }
            },
            name,
            dataType;

        for (name in builtInTypes) {
            dataType = builtInTypes[name];

            dataType.tests.forEach(function (test) {
                it(name + ((dataType.alias) ? ' (' + dataType.alias + ') ' : '') + ' should return: ' +
                    JSON.stringify(test.output) + ' given: ' + JSON.stringify(test.input), function () {
                    var input = test.input,
                        output = test.output;

                    if (typeof input === 'object') {
                        input = JSON.stringify(input);
                    }

                    if (typeof output === 'object') {
                        output = JSON.stringify(output);
                    }

                    assert.equal(input, output);
                });
            });
        }
    });
});
