module.exports = {
    init: function (config, eventEmitter) {
        if (config.enabled) {
            console.log('Debug: init called');

            eventEmitter.on('event', function(event) {
                console.log('Debug: event called');
                console.log(event);
            });
        }
    },

    validateConfig: function (config, scopeConfig, globalConfig) {
        console.log('Debug: validateConfig called');
        return [];
    }
};