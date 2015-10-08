#!/usr/bin/env node

'use strict';

var yargs = require('yargs')
        .usage('Usage: $0 <command> [options]')
        .default('c', './lapidus.json')
        .alias('c', 'config')
        .describe('c', 'Configuration file (JSON format)')
        .help('h')
        .alias('h', 'help')
        .default('t', false)
        .alias('t', 'test')
        .describe('t', 'Test the configuration file and then exit'),
    argv = yargs.argv,
    fs = require('fs'),
    path = require('path'),
    Lapidus = require('./src/lapidus'),
    lapidus;

function bail(reason) {
    yargs.showHelp();
    console.error(reason);
    process.exit(1);
}

fs.readFile(argv.config, 'utf-8', function(err, config) {
    var error;

    if (err) {
        bail('An error occurred loading the configuration file (' + path.resolve(argv.config) + '): ' + err);
    }

    try {
        config = Lapidus.prototype.parseConfig(config);
    } catch (e) {
        bail('An error occurred parsing the configuration file (' + path.resolve(argv.config) + '): ' + err);
    }

    error = Lapidus.prototype.validateConfig(config);

    if (error) {
        bail(error);
    }

    if (argv.test) {
        console.log('The configuration file is well-formed. Good job!');
        process.exit(0);
    }

    config.autoStart = true;

    lapidus = new Lapidus(config);
});
