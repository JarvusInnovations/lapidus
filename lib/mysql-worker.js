var MySql = require('./mysql.js'),
    mysql,
    config,
    plugins = [];

function init(config) {
    'use strict';

    console.log(`MySQL: Connecting to ${config.database} on ${config.hostname} as ${config.username} [#${config.serverId}]`);
}

process.on('message', function (msg) {
    'use strict';

    msg = JSON.parse(msg);

    if (!config) {
        config = msg;
        init(config);
        // TODO: zongji throws errors from async functions, we can't do much with error handling until that's fixed
        // see: index.js:102
        mysql = new MySql(config);

        for (var plugin in config.plugins) {
            var config = config.plugins[plugin];
            plugin = require('./plugins/' + plugin);
            plugins.push(plugin);
            plugin.init(config, mysql);
        }

        mysql.start(function (err) {
            if (err) {
                throw err;
            }
        });
    }
});