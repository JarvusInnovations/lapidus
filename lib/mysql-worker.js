var MySql = require('./mysql.js'),
    mysql,
    config;

process.on('message', function (msg) {
    msg = JSON.parse(msg);

    if (!config) {
        config = msg;
        init(config);
        // TODO: zongji throws errors from async functions, we can't do much with error handling until that's fixed
        // see: index.js:102
        mysql = new MySql(config);
        mysql.start();
    }
});

function init(config) {
    console.log(`Connecting to ${config.database} on ${config.hostname} as ${config.username} [#${config.serverId}]`);
}