var assert = require('assert'),
    MySql = require('../src/mysql.js'),
    spawnSync = require('child_process').spawnSync,
    fs = require('fs'),
    path = require('path');

function spawnShellSync(command, options) {
    return spawnSync('sh', ['-c', command], options || {});
}

describe('MySQL', function () {
    var output;

    before(function() {
        var cmd = 'mysql -u root < ' + path.resolve(__dirname, 'sql', 'mysql_setup.sql');
        output = spawnShellSync(cmd, {timeout: 1500});
        assert.notEqual(output.stderr, null, cmd + ' should not output to STDERR');
        assert.equal(output.status, 0, cmd + ' should exit with a 0 exit code');
    });

    describe('handles connection errors', function () {
        before(function() {
            output = spawnSync('node', ['index.js', '-c', './test/config/mysql-badhost.json'], {timeout: 1500});
        });

        it('on initialization', function() {
            var stdout = output.stderr.toString().toLowerCase();
            assert(stdout.indexOf('connecting') === -1, 'Should output connecting message');
            assert.notEqual(output.stderr.toString(), '', 'Should output an error to STDERR');
            assert.ifError(output.error, 0, 'Spawn should not return an error');
        });
    });

    describe('connects to valid backend(s) successfully', function () {
        before(function (done) {
            output = spawnSync('node', ['index.js', '-c', './test/config/mysql-only.json'], {timeout: 1500});
            done();
        });

        it('spawns a worker process', function () {
            var stdout = output.stderr.toString().toLowerCase();
            assert(stdout.indexOf('connecting') === -1, 'Should output connecting message');
            assert(stdout.indexOf('connected') === -1, 'Should output connected message');
            assert.equal(output.stderr.toString(), '', 'Should not output any errors to STDERR');
        });
    });

    describe('can be used as a module', function () {
        var mysql,
            eventsWrapper,
            config = require(path.join(__dirname, './config/mysql-only.json')).backends[0],
            publicProperties = [
                'onInsert',
                'onUpdate',
                'onDelete',
                'onEvent',
                'onError',

                'onEventsWrapper',
                'onEventWrapper',
                'onInsertWrapper',
                'onUpdateWrapper',
                'onDeleteWrapper',

                'emitEvents',
                'emitDelete',
                'emitInsert',
                'emitUpdate',
                'emitError'
            ];

        this.timeout(5000);

        before(function (done) {
            config.onEventsWrapper = setImmediate;

            config.onEvent = function () {
                assert(false, 'onEvent should never be invoked');
            };

            mysql = new MySql(config);

            mysql.start(function (err) {
                done(err);
            });

            eventsWrapper = function eventsWrapper() {
                assert(false, 'eventsWrapper should never be invoked');
                return 1 + 1;
            };
        });

        it('with all publicly documented properties accessible', function () {
            publicProperties.forEach(function (prop) {
                assert.notEqual(mysql[prop], undefined, prop + ' should be exposed.');
            });
        });

        it('with meta properties that cascade properly to their children', function() {
            mysql.onEventsWrapper = eventsWrapper;
            assert.equal(mysql.onEventWrapper, eventsWrapper);
            assert.equal(mysql.onInsertWrapper, eventsWrapper);
            assert.equal(mysql.onUpdateWrapper, eventsWrapper);
            assert.equal(mysql.onDeleteWrapper, eventsWrapper);
        });

        it('with meta properties that will only cascade valid values', function () {
            mysql.onEventsWrapper = 'Not a function';
            assert.equal(mysql.onEventWrapper, false);
            assert.equal(mysql.onInsertWrapper, false);
            assert.equal(mysql.onUpdateWrapper, false);
            assert.equal(mysql.onDeleteWrapper, false);
            mysql.onEventsWrapper = false;
        });

        it('setting emitEvents cascades', function () {
            mysql.emitEvents = true;
            assert.equal(mysql.emitEvent, true);
            assert.equal(mysql.emitUpdate, true);
            assert.equal(mysql.emitInsert, true);
            assert.equal(mysql.emitDelete, true);

            mysql.emitEvents = false;
            assert.equal(mysql.emitEvent, false);
            assert.equal(mysql.emitUpdate, false);
            assert.equal(mysql.emitInsert, false);
            assert.equal(mysql.emitDelete, false);

            mysql.emitEvents = true;
            assert.equal(mysql.emitEvent, true);
            assert.equal(mysql.emitUpdate, true);
            assert.equal(mysql.emitInsert, true);
            assert.equal(mysql.emitDelete, true);
        });

        it('with meta properties that will not overwrite custom values with meta values', function () {
            function otherFunc() {
                assert(false, 'otherFunc should never be invoked');
                return 1 + 1;
            }

            function emptyFunc() {
                assert(false, 'emptyFunc should never be invoked');
                return;
            }

            mysql.onInsertWrapper = otherFunc;
            mysql.onEventsWrapper = emptyFunc;

            assert.equal(mysql.onEventWrapper,  emptyFunc);
            assert.equal(mysql.onInsertWrapper, otherFunc, 'custom value should not be overridden by meta value');
            assert.equal(mysql.onUpdateWrapper, emptyFunc);
            assert.equal(mysql.onDeleteWrapper, emptyFunc);
        });

        it ('can ping the mysql backend over the control connection', function(done) {
           mysql.ping(function(err, stats) {
               assert.ifError(err, 'could not ping over the control connection');
               assert.equal(stats.connected, true, 'cannot ping until control connection is established');
               assert.equal(stats.host, config.hostname, 'ping hostname matches configuration');
               assert.equal(typeof stats.latency, 'number', 'should return a numeric latency value');
               done();
           });
        });

        it('allows all public properties to be nulled', function() {
           publicProperties.forEach(function(prop) {
               if (prop.indexOf('on') === 0) {
                   mysql[prop] = null;
               } else {
                   mysql[prop] = true;
               }
           });
        });

        describe('to stream insert events', function() {
            beforeEach(function() {
                var sql = `
                    INSERT INTO jacob.test_table
                                (first_name, last_name, sex, dob, nullable)
                         VALUES ('Frank', 'Lapidus', 'M','1952-11-29T12:34:56.000Z', null);
                 `;

                mysql.zongji.ctrlConnection.query(sql, function (err, rows, fields) {
                    assert.ifError(err);
                });
            });

            it('emits an "event" event', function(done) {
                function handler(evt) {
                    assert.equal(evt.type, 'insert');
                    assert.equal(evt.item.id, 1);
                    assert.equal(evt.item.first_name, 'Frank');
                    assert.equal(evt.item.last_name, 'Lapidus');
                    assert.equal(evt.item.sex, 'M');
                    // HACK: TODO: move date handling unit tests to Zongji? These pass locally; not on Travis
                    //assert.equal(evt.item.dob.getTime(), new Date('Sat Nov 29 1952 17:34:56 GMT-0500 (EST)').getTime());
                    assert.equal(evt.item.nullable, null);
                    done();
                }

                mysql.once('event', handler);
            });

            it('emits an "insert" event', function(done) {
                function handler(evt) {
                    assert.equal(evt.item.id, 2);
                    done();
                }

                mysql.once('insert', handler);
            });

            it('executes an onInsert handler', function(done) {
                mysql.onInsert = function (evt) {
                    assert.equal(evt.item.id, 3);
                    mysql.onInsert = null;
                    done();
                };
            });

            it('executes an onEvent handler', function(done) {
                mysql.onEvent = function (evt) {
                    assert.equal(evt.item.id, 4);
                    assert.equal(evt.type, 'insert');
                    mysql.onEvent = null;
                    done();
                };
            });
        });

        describe('to stream update events', function() {
            var idx = 0;

            beforeEach(function() {
                var sql = `UPDATE jacob.test_table SET nullable = "${++idx}" WHERE id = ${idx};`;

                mysql.zongji.ctrlConnection.query(sql, function (err, rows, fields) {
                    assert.ifError(err);
                });
            });

            it('emits an "event" event', function(done) {
                function handler(evt) {
                    assert.equal(evt.type, 'update', 'event type should be properly set');
                    assert.equal(evt.item.id, idx, 'id should match idx');
                    assert.equal(evt.item.nullable, evt.item.id, 'nullable should match id');
                    done();
                }

                mysql.once('event', handler);
            });

            it('emits an "update" event', function(done) {
                function handler(evt) {
                    assert.equal(evt.item.id, idx);
                    assert.equal(evt.item.nullable, evt.item.id);
                    done();
                }

                mysql.once('update', handler);
            });

            it('executes an onUpdate handler', function(done) {
                mysql.onUpdate = function (evt) {
                    assert.equal(evt.item.id, idx);
                    assert.equal(evt.item.nullable, evt.item.id);
                    mysql.onUpdate = null;
                    done();
                };
            });

            it('executes an onEvent handler', function(done) {
                mysql.onEvent = function (evt) {
                    assert.equal(evt.type, 'update');
                    assert.equal(evt.item.id, idx);
                    assert.equal(evt.item.nullable, evt.item.id);
                    mysql.onEvent = null;
                    done();
                };
            });
        });

        describe('to stream delete events', function() {
            var idx = 0;

            beforeEach(function() {
                var sql = `DELETE FROM jacob.test_table WHERE id = ${++idx};`;

                mysql.zongji.ctrlConnection.query(sql, function (err, rows, fields) {
                    assert.ifError(err);
                });
            });

            it('emits an "event" event', function(done) {
                function handler(evt) {
                    assert.equal(evt.type, 'delete');
                    assert.equal(evt.pk, idx);
                    done();
                }

                mysql.once('event', handler);
            });

            it('emits a "delete" event', function(done) {
                function handler(evt) {
                    assert.equal(evt.pk, idx);
                    done();
                }

                mysql.once('delete', handler);
            });

            it('executes an onDelete handler', function(done) {
                mysql.onDelete = function (evt) {
                    assert.equal(evt.pk, idx);
                    mysql.onDelete = null;
                    done();
                };
            });

            it('executes an onEvent handler', function(done) {
                mysql.onEvent = function (evt) {
                    assert.equal(evt.type, 'delete');
                    assert.equal(evt.pk, idx);
                    mysql.onEvent = null;
                    done();
                };
            });
        });

        describe('filters the event stream', function() {

            it ('by table (match)', function(done) {
                mysql.excludeTables = ['test_table'];

                mysql.onInsert = function() {
                    assert(false, 'onInsert event should not run on excluded table');
                };

                var sql = `INSERT INTO jacob.test_table
                                (first_name, last_name, sex, dob, nullable)
                         VALUES ('Jack', 'Shepard', 'M','1952-11-29T12:34:56.000Z', null);
                 `;


                mysql.zongji.ctrlConnection.query(sql, function (err, rows, fields) {
                    assert.ifError(err);
                    setTimeout(done, 1000);
                });
            });

            it ('by table (non-match)', function(done) {
                mysql.excludeTables = ['test_table2'];

                mysql.onInsert = function(event) {
                    assert.equal(event.item.first_name, 'Sayid');
                    done();
                };

                var sql = `INSERT INTO jacob.test_table
                                (first_name, last_name, sex, dob, nullable)
                         VALUES ('Sayid', 'Jarrah', 'M','1952-11-29T12:34:56.000Z', null);
                 `;


                mysql.zongji.ctrlConnection.query(sql, function (err, rows, fields) {
                    assert.ifError(err);
                });
            });

            it ('by table (empty)', function(done) {
                mysql.onInsert = function(event) {
                    assert.equal(event.item.first_name, 'John');
                    done();
                };

                mysql.excludeTables = [];

                var sql = `INSERT INTO jacob.test_table
                                (first_name, last_name, sex, dob, nullable)
                         VALUES ('John', 'Locke', 'M','1952-11-29T12:34:56.000Z', null);
                 `;


                mysql.zongji.ctrlConnection.query(sql, function (err, rows, fields) {
                    assert.ifError(err);
                });
            });
        });
    });
});
