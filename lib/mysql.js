var events = require('events'),
    ZongJi = require('zongji');

function MySql(config) {
    'use strict';

    this.zongji = new ZongJi({
        host: config.hostname,
        user: config.username,
        password: config.password
    });

    events.EventEmitter.call(this);

    this.schemaTablePrimaryKeys = {};
}

MySql.prototype.start = function start(cb) {
    this.zongji.connection.query(`
SELECT t.TABLE_SCHEMA AS 'schema',
       t.TABLE_NAME AS 'table',
       k.COLUMN_NAME AS 'column'
  FROM information_schema.TABLE_CONSTRAINTS t
  JOIN information_schema.KEY_COLUMN_USAGE k
 USING (CONSTRAINT_NAME, TABLE_SCHEMA, TABLE_NAME)
 WHERE t.CONSTRAINT_TYPE = 'PRIMARY KEY' AND
	   t.TABLE_SCHEMA != 'mysql';
`, function (err, pks) {
        if (err) {
            return cb(err);
        }

        pks.forEach(function (pk) {
            this.schemaTablePrimaryKeys[pk.schema] = this.schemaTablePrimaryKeys[pk.schema] || {};
            this.schemaTablePrimaryKeys[pk.schema][pk.table] = pk.column;
        });

        this.zongji.start({
            includeEvents: ['tablemap', 'writerows', 'updaterows', 'deleterows'],
            startAtEnd: true
        });

        console.log('MySQL: Found ' + pks.length + ' primary keys... caching for fast lookups');

        cb(null);
    });

    this.zongji.on('binlog', function (evt) {
        var eventName = evt.getEventName(),
            tableName = evt.tableMap[evt.tableId].tableName,
            schemaName = evt.tableMap[evt.tableId].parentSchema;

        if (eventName === 'tablemap') {
            return;
        }

        if (eventName === 'deleterows') {
            evt.rows.forEach(function (row) {
                var pk = this.schemaTablePrimaryKeys[schemaName][tableName] || row.id || row.ID,
                    eventName = tableName + (pk ? ':' + pk : '');

                this.emit(eventName, {
                    type: 'delete',
                    item: pk
                });
            });
        } else if (eventName === 'writerows') {
            evt.rows.forEach(function (row) {
                var pk = this.schemaTablePrimaryKeys[schemaName][tableName] || row.id || row.ID,
                    eventName = tableName + (pk ? ':' + pk : '');

                this.emit(eventName, {
                    type: 'insert',
                    item: row
                });
            });
        } else if (eventName === 'updaterows') {
            evt.rows.forEach(function (row) {
                var pk = this.schemaTablePrimaryKeys[schemaName][tableName] || row.id || row.ID,
                    eventName = tableName + (pk ? ':' + pk : '');

                this.emit(eventName, {
                    type: 'update',
                    item: row
                });
            });
        }
    });
};

module.exports = MySql;