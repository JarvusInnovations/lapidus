var MongoDb = require('./mongo.js'),
    mongo,
    config,
    plugins = [];

function init(config) {
    'use strict';

    console.log(`MongoDB: Connecting to ${config.database} on ${config.host} as ${config.user}`);
}

process.on('message', function (msg) {
    'use strict';

    msg = JSON.parse(msg);

    if (!config) {
        config = msg;
        init(config);

        mongo = new MongoDb(config);

        for (var plugin in config.plugins) {
            var config = config.plugins[plugin];
            plugin = require('./plugins/' + plugin);
            plugins.push(plugin);
            plugin.init(config, pg);
        }


        mongo.on('error', function(err) {
            console.error(err);
        });

        mongo.init(function(err) {
            if (err) {
                throw err;
            }

            mongo.start(function(err) {
                if (err) {
                    throw err;
                }
            });
        });
    }
});
