#!/usr/bin/env node

var argv = require('yargs')
        .usage('Usage: $0 <command> [options]')
        .default('c', './lapidus.json')
        .alias('c', 'config')
        .describe('c', 'Configuration file (JSON format)')
        .help('h')
        .alias('h', 'help')
        .default('t', false)
        .alias('t', 'test')
        .describe('t', 'Test the configuration file and then exit')
        .argv,

    fs = require('fs'),
    cluster = require('cluster'),
    jsonlint = require('jsonlint'),

    config;

function loadConfig(path, cb) {
    'use strict';

    fs.readFile(path, 'utf-8', function (err, data) {
        if (err) {
            return cb(err, null);
        }

        try {
            data = jsonlint.parse(data);
        } catch (e) {
            return cb(e, null);
        }

        cb(validateConfig(data), data);
    });
}

function validateConfig(config) {
    var errors = [],
        error;

    if (!Array.isArray(config.backends) || config.backends.length === 0) {
        errors.push('Lapidus requires one or more backends to start.');
    } else {
        config.backends.forEach(function (backend, i) {
            var workerFilename = `./lib/${backend.type}-worker.js`;

            if (!fs.existsSync(workerFilename)) {
                errors.push('Invalid backend type specified: ' + backend.type);
            }
        });
    }

    if (errors.length > 0) {
        return new Error(errors.join('\n'));
    }

    return null;
}

if (!module.parent) {
    // Lapidus was invoked from the command line
    loadConfig(argv.config, function (err, configFile) {

        if (err) {
            console.error('Error loading configuration file: ' + err);
            process.exit(1);
        }

        config = configFile;

        if (argv.test) {
            process.exit(0);
        }

        if (cluster.isMaster) {
            config.backends.forEach(function (backend, i) {
                var workerFilename = `./lib/${backend.type}-worker.js`,
                    worker;

                cluster.setupMaster({
                    exec: workerFilename
                });

                worker = cluster.fork();

                worker.on('online', function() {
                    worker.send(JSON.stringify(backend));
                });
            });
        }
    });
} else {
    // Lapidus was required as a module
    exports.loadConfig = loadConfig;
}