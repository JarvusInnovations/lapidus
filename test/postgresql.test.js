var assert = require('assert'),
    PostgreSql = require('../src/postgresql.js'),
    spawnSync = require('child_process').spawnSync,
    fs = require('fs'),
    path = require('path');

describe('PostgreSQL', function () {
    var output;

    before(function (done) {
        output = spawnSync('node', ['index.js', '-c', './test/config/postgresql-only.json'], {timeout: 1500});
        done();
    });

    it('connects to PostgreSQL valid backends', function () {
        assert.equal(output.status, 0);
        assert.equal(output.stderr.toString(), '');
    });

    describe('Can be used as a module', function () {
        var postgresql,
            eventsWrapper;

        before(function (done) {
            var config = require(path.join(__dirname, './config/postgresql-only.json')).backends[0];

            // The slot will still be in use from the spawned process above
            config.slot = config.slot + '1';

            config.onEventsWrapper = setImmediate;

            config.onEvent = function () {
                console.log('onEvent');
                console.log(arguments);
            };

            postgresql = new PostgreSql(config);

            postgresql.init(function(err) {
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

        it('with all publicly documented properties accessible', function () {
            var expectedProperties = [
                'onInsert',
                'onUpdate',
                'onDelete',
                'onEvent',

                'onEventsWrapper',
                'onEventWrapper',
                'onInsertWrapper',
                'onUpdateWrapper',
                'onDeleteWrapper',

                'emitEvents',
                'emitDelete',
                'emitInsert',
                'emitUpdate'
            ];

            expectedProperties.forEach(function (prop) {
                assert.notEqual(postgresql[prop], undefined, prop + ' should be exposed.');
            });
        });

        it('with meta properties that cascade properly to their children', function() {
            postgresql.onEventsWrapper = eventsWrapper;
            assert.equal(postgresql.onEventWrapper, eventsWrapper);
            assert.equal(postgresql.onInsertWrapper, eventsWrapper);
            assert.equal(postgresql.onUpdateWrapper, eventsWrapper);
            assert.equal(postgresql.onDeleteWrapper, eventsWrapper);
        });

        it('with meta properties that will only cascade valid values', function () {
            postgresql.onEventsWrapper = 'Not a function';
            assert.equal(postgresql.onEventWrapper, false);
            assert.equal(postgresql.onInsertWrapper, false);
            assert.equal(postgresql.onUpdateWrapper, false);
            assert.equal(postgresql.onDeleteWrapper, false);
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

            assert.equal(postgresql.onEventWrapper,  emptyFunc);
            assert.equal(postgresql.onEventWrapper,  emptyFunc);
            assert.equal(postgresql.onInsertWrapper, otherFunc, 'custom value should not be overridden by meta value');
            assert.equal(postgresql.onUpdateWrapper, emptyFunc);
            assert.equal(postgresql.onDeleteWrapper, emptyFunc);
        });
    });
});
