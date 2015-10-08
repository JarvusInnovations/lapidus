var assert = require('assert'),
    MongoDb = require('../src/mongo.js'),
    spawnSync = require('child_process').spawnSync,
    fs = require('fs'),
    path = require('path');

describe('MongoDB', function () {
    describe('Can be used as a module', function () {
        var mongo,
            eventsWrapper;

        before(function (done) {
            var config = require(path.join(__dirname, './config/mongo-only.json')).backends[0];

            // The slot will still be in use from the spawned process above
            config.slot = config.slot + '1';

            config.onEventsWrapper = setImmediate;

            config.onEvent = function () {
                console.log('onEvent');
                console.log(arguments);
            };

            mongo = new MongoDb(config);

            mongo.init(function(err) {
                assert.ifError(err);

                mongo.start(function (err) {
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
                assert.notEqual(mongo[prop], undefined, prop + ' should be exposed.');
            });
        });

        it('with meta properties that cascade properly to their children', function() {
            mongo.onEventsWrapper = eventsWrapper;
            assert.equal(mongo.onEventWrapper, eventsWrapper);
            assert.equal(mongo.onInsertWrapper, eventsWrapper);
            assert.equal(mongo.onUpdateWrapper, eventsWrapper);
            assert.equal(mongo.onDeleteWrapper, eventsWrapper);
        });

        it('with meta properties that will only cascade valid values', function () {
            mongo.onEventsWrapper = 'Not a function';
            assert.equal(mongo.onEventWrapper, false);
            assert.equal(mongo.onInsertWrapper, false);
            assert.equal(mongo.onUpdateWrapper, false);
            assert.equal(mongo.onDeleteWrapper, false);
        });

        it('with meta properties that will not overwrite custom values with meta values', function () {
            function otherFunc() {
                return 1 + 1;
            }

            function emptyFunc() {
                return;
            }

            mongo.onInsertWrapper = otherFunc;
            mongo.onEventsWrapper = emptyFunc;

            assert.equal(mongo.onEventWrapper,  emptyFunc);
            assert.equal(mongo.onEventWrapper,  emptyFunc);
            assert.equal(mongo.onInsertWrapper, otherFunc, 'custom value should not be overridden by meta value');
            assert.equal(mongo.onUpdateWrapper, emptyFunc);
            assert.equal(mongo.onDeleteWrapper, emptyFunc);
        });

        it('setting emitEvents cascades', function () {
            mongo.emitEvents = true;
            assert.equal(mongo.emitEvent, true);
            assert.equal(mongo.emitUpdate, true);
            assert.equal(mongo.emitInsert, true);
            assert.equal(mongo.emitDelete, true);

            mongo.emitEvents = false;
            assert.equal(mongo.emitEvent, false);
            assert.equal(mongo.emitUpdate, false);
            assert.equal(mongo.emitInsert, false);
            assert.equal(mongo.emitDelete, false);
        });
    });
});
