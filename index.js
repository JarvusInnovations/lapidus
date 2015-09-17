#!/usr/bin/env node

var argv = require('yargs')
        .usage('Usage: $0 <command> [options]')
        .default('c', './lapidus.json')
        .alias('c', 'config')
        .describe('c', 'Configuration file (JSON format)')
        .help('h')
        .alias('h', 'help')
        .argv,

    fs = require('fs'),
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

        cb(null, data);
    });
}

if (!module.parent) {
    // Lapidus was invoked from the command line
    loadConfig(argv.config, function (err, configFile) {
        if (err) {
            console.error('Unable to load configuration file: ' + err);
            process.exit(1);
        }

        config = configFile;
    });
} else {
    // Lapidus was required as a module
    exports.loadConfig = loadConfig;
}