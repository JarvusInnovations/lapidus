var pg = require('./postgresql.js'),
    config;

function init(config) {
    'use strict';

    console.log(`Connecting to ${config.database} on ${config.hostname} as ${config.username} [${config.slot}]`);
}

process.on('message', function (msg) {
    'use strict';

    msg = JSON.parse(msg);

    if (!config) {
        config = msg;
        init(config);
    }
});
