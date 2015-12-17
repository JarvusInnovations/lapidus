var PostgresLogicalReceiver = require('./postgresql.js'),
    pg,
    config,
    plugins = [];

function init(config) {
    'use strict';

    console.log(`PostgreSQL: Connecting to ${config.database} on ${config.host} as ${config.user}`);
}

process.on('message', function (msg) {
    'use strict';

    msg = JSON.parse(msg);

    if (!config) {
        config = msg;
        init(config);

        pg = new PostgresLogicalReceiver(config);

        for (var plugin in config.plugins) {
            var pluginConfig = config.plugins[plugin];
            plugin = require('./plugins/' + plugin);
            plugins.push(plugin);
            plugin.init(pluginConfig, pg);
        }


        pg.on('error', function(err) {
           console.error('PostgreSQL: ' + err);
        });

        pg.init(function(err) {
           if (err) {
               throw err;
           }

           pg.start(function(err) {
              if (err) {
                  throw err;
              }
           });
        });
    }
});
