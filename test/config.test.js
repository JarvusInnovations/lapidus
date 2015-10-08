var assert = require('assert'),
    Lapidus = require('../src/lapidus'),
    path = require('path'),
    fs = require('fs');

describe('Configuration File', function () {

    it('returns a helpful error when the config file contains a syntax error', function () {
        assert.throws(function() {
            Lapidus.prototype.parseConfig('{"invalid":: \'json\'}');
        }, /Parse/);
    });

    it('returns the configuration file on success', function (done) {
        fs.readFile(path.join(__dirname, './config/lapidus.json'), 'utf8', function (err, file) {
           if (err) {
               throw err;
           }

            assert.equal(JSON.stringify(Lapidus.prototype.parseConfig(file)), JSON.stringify(JSON.parse(file)));
            done();
        });
    });

    it('returns a helpful error when no backends are configured', function () {
        assert.notEqual(Lapidus.prototype.validateConfig({ backends: [] }).toString().indexOf('one or more'), -1);
        assert.notEqual(Lapidus.prototype.validateConfig({}).toString().indexOf('one or more'), -1);
    });

    it('returns a helpful error when a non-existent backend is configured', function () {
        assert.notEqual(Lapidus.prototype.validateConfig({
            backends: [
                {
                    type: 'made up'
                }
            ]
        }).toString().indexOf('Invalid backend'), -1);
    });

    it('returns a helpful error when a non-existent plugin is configured', function () {
        assert.notEqual(Lapidus.prototype.validateConfig({
            backends: [{ type: 'mysql' }],

            plugins: {
                'made up': {
                    fake: true
                }
            }
        }).toString().indexOf('plugin'), -1);
    });

});