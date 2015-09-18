var EventEmitter = require('events').EventEmitter,
    ZongJi = require('zongji');

function MySql(config) {
    'use strict';

    this.zongji = new ZongJi({
        host: config.hostname,
        user: config.username,
        password: config.password
    });

    EventEmitter.call(this);

    this.schemaTablePrimaryKeys = {};
}
MySql.prototype = new EventEmitter;

MySql.prototype.start = function start(cb) {
    var zongji = this.zongji,
        self = this;

    zongji.connection.query(`
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
            self.schemaTablePrimaryKeys[pk.schema] = self.schemaTablePrimaryKeys[pk.schema] || {};
            self.schemaTablePrimaryKeys[pk.schema][pk.table] = pk.column;
        });

        zongji.start({
            includeEvents: ['tablemap', 'writerows', 'updaterows', 'deleterows'],
            startAtEnd: true
        });

        console.log('MySQL: Found ' + pks.length + ' primary keys... caching for fast lookups');

        zongji.on('binlog', function (evt) {
            var eventName = evt.getEventName(),
                tableName = evt.tableMap[evt.tableId].tableName,
                schemaName = evt.tableMap[evt.tableId].parentSchema,
                pk, eventName, row, len, x;

            if (eventName === 'tablemap') {
                return;
            }

            pk = self.schemaTablePrimaryKeys[schemaName][tableName];
            len = evt.rows.length;

            if (eventName === 'deleterows') {
                for (x = 0; x < len; x++) {
                    row = evt.rows[x];

                    self.emit('delete', {
                        pk: row[pk],
                        table: tableName,
                        schema: schemaName
                    });
                }
            } else if (eventName === 'writerows') {
                for (x = 0; x < len; x++) {
                    row = evt.rows[x];

                    self.emit('insert', {
                        pk: row[pk],
                        table: tableName,
                        schema: schemaName,
                        item: row
                    });
                }
            } else if (eventName === 'updaterows') {
                for (x = 0; x < len; x++) {
                    row = evt.rows[x];

                    self.emit('update', {
                        pk: row.after[pk],
                        table: tableName,
                        schema: schemaName,
                        item: row.after
                    });
                }
            }
        });

        cb && cb(null);
    });
};

module.exports = MySql;