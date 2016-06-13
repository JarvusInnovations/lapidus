module.exports = {
    init: function (config, eventEmitter) {
        if (config.enabled) {
            console.log('Debug: plugin init called; attaching event listeners');

            eventEmitter.on('event', function(event) {
                console.log('Debug: event emitted');
                console.log(event);
            });

            eventEmitter.on('update', function(event) {
                console.log('Debug: update emitted');
                console.log(event);
            });
            eventEmitter.on('insert', function(event) {
                console.log('Debug: insert emitted');
                console.log(event);
            });

            eventEmitter.on('delete', function(event) {
                console.log('Debug: delete emitted');
                console.log(event);
            });

            eventEmitter.on('schema', function(event) {
                console.log('Debug: schema emitted');
                console.log(event);
            });
        }
    },

    validateConfig: function (config, scopeConfig, globalConfig) {
        console.log('Debug: validateConfig called; (no-op)');
        return [];
    }
};