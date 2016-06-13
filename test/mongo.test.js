'use strict';

var assert = require('assert'),
    MongoDb = require('../src/mongo.js'),
    spawnSync = require('child_process').spawnSync,
    fs = require('fs'),
    path = require('path'),
    MongoClient = require('mongodb').MongoClient,
    url = 'mongodb://localhost:27017/lapidus';

describe('MongoDB', function () {
    var db,
        output;

    before(function (done) {
        output = spawnSync('node', ['index.js', '-c', './test/config/mongo-only.json'], {timeout: 1500});
        done();
    });

    before(function (done) {
        MongoClient.connect(url, function (err, _db) {
            assert.equal(null, err, 'Unable to connect from Node to execute test queries: ' + err);
            db = _db;
            done();
        });
    });

    it('connects to valid MongoDB backend(s)', function () {
        assert.equal(output.status, 0);
        assert.equal(output.stderr.toString(), '');
    });

    describe('Can be used as a module', function () {
        var mongo,
            eventsWrapper;

        before(function (done) {
            var config = require(path.join(__dirname, './config/mongo-only.json')).backends[0];

            mongo = new MongoDb(config);

            mongo.init(function (err) {
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

        it('with meta properties that cascade properly to their children', function () {
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

            assert.equal(mongo.onEventWrapper, emptyFunc);
            assert.equal(mongo.onEventWrapper, emptyFunc);
            assert.equal(mongo.onInsertWrapper, otherFunc, 'custom value should not be overridden by meta value');
            assert.equal(mongo.onUpdateWrapper, emptyFunc);
            assert.equal(mongo.onDeleteWrapper, emptyFunc);
        });

        it('setting emitEvents cascades', function () {
            mongo.emitEvents = false;
            assert.equal(mongo.emitEvent, false);
            assert.equal(mongo.emitUpdate, false);
            assert.equal(mongo.emitInsert, false);
            assert.equal(mongo.emitDelete, false);

            mongo.emitEvents = true;
            assert.equal(mongo.emitEvent, true);
            assert.equal(mongo.emitUpdate, true);
            assert.equal(mongo.emitInsert, true);
            assert.equal(mongo.emitDelete, true);
        });

        describe('to stream insert events', function () {

            before(function(done) {
                var config = require(path.join(__dirname, './config/mongo-only.json')).backends[0];

                mongo = new MongoDb(config);

                mongo.init(function (err) {
                    assert.ifError(err);

                    mongo.start(function (err) {
                        assert.ifError(err);
                        done();
                    });
                });
            });

            function insertDocuments(callback) {
                var collection = db.collection('lapidus');

                collection.insertMany([
                    {a : 1}, {b : 2}, {c : 3}
                ], function(err, result) {
                    if (err) {
                        return callback && callback(err);
                    }
                    assert.equal(3, result.result.n);
                    assert.equal(3, result.ops.length);
                    callback && callback();
                });
            }

            it('emits an "event" event', function (done) {
                function handler(evt) {
                    assert.equal(evt.type, 'insert');
                    assert.notEqual(evt.item, undefined, 'missing item');
                    assert.notEqual(evt.pk, undefined, 'missing pk');
                    assert.equal(evt.pk, evt.item._id, 'pk does not match item');
                    assert.equal(evt.item.a, 1, 'items arrived out of order');
                    assert.equal(evt.ns, 'lapidus.lapidus', 'ns set incorrectly');
                    done();
                }

                mongo.once('event', handler);

                insertDocuments();
            });

            it('emits an "insert" event', function (done) {
                function handler(evt) {
                    assert.notEqual(evt.item, undefined, 'missing item');
                    assert.notEqual(evt.pk, undefined, 'missing pk');
                    assert.equal(evt.pk, evt.item._id, 'pk does not match item');
                    assert.equal(evt.item.a, 1, 'items arrived out of order');
                    assert.equal(evt.ns, 'lapidus.lapidus', 'ns set incorrectly');
                    done();
                }

                mongo.once('insert', handler);

                insertDocuments();
            });

            it('executes an onInsert handler', function (done) {
                var inserts = {};

                mongo.onInsert = function (evt) {
                    Object.keys(evt.item).forEach(key => inserts[key] = evt.item[key]);
                    if (evt.item.c) {
                        assert.equal(inserts.a, 1);
                        assert.equal(inserts.b, 2);
                        assert.equal(inserts.c, 3);
                        mongo.onInsert = null;
                        done();
                    }
                };

                insertDocuments();
            });

            it('executes an onEvent handler', function (done) {
                var inserts = {};

                mongo.onEvent = function (evt) {
                    Object.keys(evt.item).forEach(key => inserts[key] = evt.item[key]);

                    if (evt.item.c) {
                        assert.equal(evt.type, 'insert');
                        assert.equal(inserts.a, 1);
                        assert.equal(inserts.b, 2);
                        assert.equal(inserts.c, 3);
                        mongo.onInsert = null;
                        done();
                    }
                };

                insertDocuments();
            });
        });

        describe('to stream update events', function () {

            function updateDocument(callback) {
                var collection = db.collection('lapidus');

                collection.updateMany(
                    {},
                    { $set: { foo: 'bar' + Math.random() } },
                    function(err, result) {
                        if (err) {
                            return callback && callback(err);
                        }
                        callback && callback();
                    }
                );
            }

            it('emits an "event" event', function (done) {
                function handler(evt) {
                    assert.equal(evt.type, 'update');
                    done();
                }

                mongo.once('event', handler);
                updateDocument();
            });

            it('emits an "update" event', function (done) {
                function handler(evt) {
                    done();
                }

                mongo.once('update', handler);
                updateDocument();
            });

            it('executes an onUpdate handler', function (done) {
                mongo.onUpdate = function (evt) {
                    mongo.onUpdate = null;
                    done();
                };

                updateDocument();
            });

            it('executes an onEvent handler', function (done) {
                mongo.onEvent = function (evt) {
                    assert.equal(evt.type, 'update');
                    mongo.onEvent = null;
                    done();
                };

                updateDocument();
            });
        });

        describe('to stream delete events', function () {
            function deleteDocument(callback) {
                var collection = db.collection('lapidus');

                collection.deleteOne(
                    {},
                    function(err, result) {
                        if (err) {
                            return callback && callback(err);
                        }
                        assert.equal(1, result.result.n);
                        callback && callback();
                    }
                );
            }

            it('emits an "event" event', function (done) {
                function handler(evt) {
                    assert.equal(evt.type, 'delete');
                    assert.equal(evt.item, undefined);
                    done();
                }

                mongo.once('event', handler);
                deleteDocument();
            });

            it('emits a "delete" event', function (done) {
                function handler(evt) {
                    done();
                }

                mongo.once('delete', handler);
                deleteDocument();
            });

            it('executes an onDelete handler', function (done) {
                mongo.onDelete = function (evt) {
                    mongo.onDelete = null;
                    done();
                };

                deleteDocument();
            });

            it('executes an onEvent handler', function (done) {
                mongo.onEvent = function (evt) {
                    assert.equal(evt.type, 'delete');
                    assert.equal(evt.item, undefined);
                    mongo.onEvent = null;
                    done();
                };

                deleteDocument();
            });
        });

        after(function (done) {
            db.close();
            done();
        });
    });
});