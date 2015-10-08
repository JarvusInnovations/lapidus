'use strict';

const util = require('util');
const EventEmitter = require('events');
const MongoOplog = require('mongo-oplog');

function Mongo(options) {
    options = options || {};

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

    EventEmitter.call(this);
}

// This line must appear before anything is added to the Mongo prototype
util.inherits(Mongo, EventEmitter);

Object.defineProperty(Mongo.prototype, 'onEventsWrapper', {
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

Object.defineProperty(Mongo.prototype, 'emitEvents', {
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

/*
var oplog = MongoOplog('mongodb://127.0.0.1:27017/lapidus');

oplog.tail(function(err, stream) {
    console.log(oplog.db);
});

oplog.on('op', function (data) {
    console.log(data);
});

oplog.on('insert', function (doc) {
    console.log(doc.op);
});

oplog.on('update', function (doc) {
    console.log(doc.op);
});

oplog.on('delete', function (doc) {
    console.log(doc.op._id);
});

oplog.on('error', function (error) {
    console.log(error);
});

oplog.on('end', function () {
    console.log('Stream ended');
});

oplog.stop(function () {
    console.log('server stopped');
});
*/

Mongo.prototype.init = function init(cb) {
    cb && cb(null, {});
};

Mongo.prototype.start = function(cb) {
    cb && cb(null, {});
};

Mongo.prototype.stop = function() {

};

Mongo.prototype.validateConfig = function() {
};

module.exports = Mongo;