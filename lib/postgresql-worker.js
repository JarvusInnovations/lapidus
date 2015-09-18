var config;

process.on('message', function (msg) {
    msg = JSON.parse(msg);

    if (!config) {
        config = msg;
        init(config);
    }
});

function init(config) {
    console.log(`Connecting to ${config.database} on ${config.hostname} as ${config.username} [${config.slot}]`);
}