var assert = require('assert'),
    MySql = require('../src/mysql.js'),
    spawnSync = require('child_process').spawnSync,
    fs = require('fs'),
    path = require('path');

describe('MySQL', function () {
    var output;

    before(function (done) {
        output = spawnSync('node', ['index.js', '-c', './test/config/mysql-only.json'], {timeout: 1500});
        done();
    });

    it('connects to MySQL valid backends', function () {
        assert.equal(output.status, 0);
        assert.equal(output.stderr.toString(), '');
    });

    describe('Can be used as a module', function () {
        var mysql,
            eventsWrapper;

        before(function (done) {
            var config = require(path.join(__dirname, './config/mysql-only.json')).backends[0];

            config.onEventsWrapper = setImmediate;

            config.onEvent = function () {
                console.log('onEvent');
                console.log(arguments);
            };

            mysql = new MySql(config);

            mysql.start(function (err) {
                assert.ifError(err);
                done();
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
        });

        it('with meta properties that will not overwrite custom values with meta values', function () {
            function otherFunc() {
                return 1 + 1;
            }

            function emptyFunc() {
                return;
            }

            mysql.onInsertWrapper = otherFunc;
            mysql.onEventsWrapper = emptyFunc;

            assert.equal(mysql.onEventWrapper,  emptyFunc);
            assert.equal(mysql.onInsertWrapper, otherFunc, 'custom value should not be overridden by meta value');
            assert.equal(mysql.onUpdateWrapper, emptyFunc);
            assert.equal(mysql.onDeleteWrapper, emptyFunc);
        });
    });
});
