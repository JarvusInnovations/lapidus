'use strict';

var path = require('path'),
    cluster = require('cluster'),
    jsonlint = require('jsonlint'),
    fs = require('fs');

function Lapidus(config) {
    var error;

    if (typeof config === 'object') {
        error = this.validateConfig(config);
    }

    if (!error) {
        this.config = config || {};
    }

    if (config.autoStart) {
        this.start();
    }
}

Lapidus.prototype.parseConfig = function parseConfig(config) {
    return jsonlint.parse(config);
};

Lapidus.prototype.validatePluginConfig = function validatePluginConfig (plugin, pluginConfig, scopeConfig, globalConfig) {
    var pluginFilename = path.join(__dirname, `plugins/${plugin}.js`),
        errors = [];

    if (typeof plugin !== 'string') {
        errors.push(`Invalid plugin name: "${plugin}" is not a string`);
    } else if (!fs.existsSync(pluginFilename)) {
        errors.push(`Unable to load ${plugin} plugin: ${pluginFilename} does not exist or is unreadable.`);
    } else {
        try {
            plugin = require(pluginFilename);

            if (typeof plugin.validateConfig === 'function') {
                errors = errors.concat(plugin.validateConfig(pluginConfig, scopeConfig, globalConfig));
            }
        } catch (e) {
            errors.push(`Failed to load ${plugin} plugin (${pluginFilename}): ${e}`);
        }
    }

    return errors;
};

Lapidus.prototype.validateConfig = function validateConfig(config) {
    var errors = [],
        self = this;

    if (!Array.isArray(config.backends) || config.backends.length === 0) {
        errors.push('Lapidus requires one or more backends to start.');
    } else {
        config.backends.forEach(function (backend) {
            var workerFilename = path.join(__dirname, `${backend.type}-worker.js`);

            if (!fs.existsSync(workerFilename)) {
                errors.push(`Invalid backend type specified: ${backend.type}`);
            }

            // worker-scoped plugins
            if (typeof backend.plugins === 'object') {
                for (var plugin in backend.plugins) {
                    errors = errors.concat(self.validatePluginConfig(backend.plugins[plugin], backend, config));
                }
            }
        });
    }

    // global plugins
    if (typeof config.plugins === 'object') {
        for (var plugin in config.plugins) {
            errors = errors.concat(self.validatePluginConfig(plugin, config.plugins[plugin], config, config));
        }
    }

    if (errors.length > 0) {
        return new Error(errors.join('\n'));
    }

    return null;
};

Lapidus.prototype.start = function start() {
    var config = this.config;

    if (cluster.isMaster) {
        config.backends.forEach(function (backend) {
            var workerFilename = path.join(__dirname, `${backend.type}-worker.js`),
                worker;

            backend.plugins = backend.plugins || config.plugins || {};

            cluster.setupMaster({
                exec: workerFilename
            });

            worker = cluster.fork();

            worker.on('online', function() {
                worker.send(JSON.stringify(backend));
            });
        });
    }
};

module.exports = Lapidus;
