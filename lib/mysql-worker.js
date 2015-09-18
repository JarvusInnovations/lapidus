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

        mysql.start(function (err) {
            if (err) {
                throw err;
            }

            mysql.on('delete', function(data) {
                console.log(data);
            });

            mysql.on('insert', function(data) {
                console.log(data);
            });

            mysql.on('update', function(data) {
                console.log(data);
            });
        });
    }
});

function init(config) {
    console.log(`Connecting to ${config.database} on ${config.hostname} as ${config.username} [#${config.serverId}]`);
}