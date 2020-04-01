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
            'onTruncate',

            'onEventsWrapper',
            'onEventWrapper',
            'onInsertWrapper',
            'onUpdateWrapper',
            'onDeleteWrapper',
            'onSchemaWrapper',
            'onTransactionWrapper',
            'onBeginTransactionWrapper',
            'onCommitTransactionWrapper',
            'onTruncateWrapper',

            'emitEvents',
            'emitDelete',
            'emitInsert',
            'emitUpdate',
            'emitError',
            'emitSchema',
            'emitBeginTransaction',
            'emitCommitTransaction',
            'emitTruncate'
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
            assert.equal(postgresql.onTruncateWrapper, eventsWrapper);
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
            assert.equal(postgresql.onTruncateWrapper, false);
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
            assert.equal(postgresql.onTruncateWrapper, emptyFunc);
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
                'onTruncate',

                'onEventsWrapper',
                'onEventWrapper',
                'onInsertWrapper',
                'onUpdateWrapper',
                'onDeleteWrapper',
                'onSchemaWrapper',
                'onTransactionWrapper',
                'onBeginTransactionWrapper',
                'onCommitTransactionWrapper',
                'onTruncateWrapper',

                'emitEvents',
                'emitDelete',
                'emitInsert',
                'emitUpdate',
                'emitTransaction',
                'emitBeginTransaction',
                'emitCommitTransaction',
                'emitTruncate'
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
            assert.equal(postgresql.emitTruncate, true);

            postgresql.emitEvents = false;
            assert.equal(postgresql.emitEvent, false);
            assert.equal(postgresql.emitUpdate, false);
            assert.equal(postgresql.emitInsert, false);
            assert.equal(postgresql.emitDelete, false);
            assert.equal(postgresql.emitSchema, false);
            assert.equal(postgresql.emitTransaction, false);
            assert.equal(postgresql.emitBeginTransaction, false);
            assert.equal(postgresql.emitCommitTransaction, false);
            assert.equal(postgresql.emitTruncate, false);
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
                done();
            }

            postgresql.once('delete', handler);
        });

        it('executes an onDelete handler', function(done) {
            postgresql.onDelete = function (evt) {
                assert.equal(evt.pk, 4);
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
                idEvents = evt.items.filter(evt => evt.item && evt.item.id !== undefined);
                assert(idEvents.length > 0, 'no events with ids to verify correct ids');
                id = idEvents[0].item.id;
                assert(idEvents.every(evt => evt.item.id === id), 'mismatched row id');
                console.log(idEvents);
                assert.equal(idEvents[0].type, 'insert');
                assert.equal(idEvents[1].type, 'update');
                assert.equal(idEvents[2].type, 'delete');
                postgresql.onTransaction = null;
                done();
            };
        });
    });

    describe('to stream truncate events', function() {
        beforeEach(function(done) {
            var sql = `TRUNCATE test_table;`;

            client.query(sql, function (err, result) {
                assert.ifError(err);
                done();
            });
        });

        it('emits an "event" event', function(done) {
            function handler(evt) {
                if (evt.type === 'truncate') {
                    done();
                    postgresql.off('event', handler);
                }
            }

            postgresql.on('event', handler);
        });

        it('executes an onEvent handler', function(done) {
            postgresql.onEvent = function (evt) {
                assert.equal(evt.type, 'truncate');
                postgresql.onEvent = null;
                done();
            };
        });

        it('emits a "truncate" event', function(done) {
            function handler(evt) {
                assert.equal(evt.type, 'truncate');
                done();
            }

            postgresql.once('truncate', handler);
        });

        it('executes an onTruncate handler', function(done) {
            postgresql.onTruncate = function (evt) {
                assert.equal(evt.type, 'truncate');
                postgresql.onTruncate = null;
                done();
            };
        });
    });
});
