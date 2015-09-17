var assert = require('assert'),
    Lapidus = require('../index.js'),
    spawnSync = require('child_process').spawnSync;

Lapidus.loadConfig('./a-way-off-the-island.json');

describe('CLI', function () {
    describe('Configuration File', function () {

        it('returns a helpful error when the file does not exist', function (done) {
            Lapidus.loadConfig('./test/config/a-way-off-the-island.json', function (err) {
                var output = spawnSync('node', ['index.js', '-c', './test/config/a-way-off-the-island.json']);

                assert.notEqual(err, null);
                assert.notEqual(output.stderr.toString().indexOf(err.message), -1);
                assert.notEqual(output.status, 0);

                done();
            });
        });

        it('returns a helpful error when we have insufficient permissions', function (done) {
            Lapidus.loadConfig('./test/config/forbidden.json', function (err) {
                var output = spawnSync('node', ['index.js', '-c', './test/config/forbidden.json']);

                assert.notEqual(err, null);
                assert.notEqual(output.stderr.toString().indexOf(err.message), -1);
                assert.notEqual(output.status, 0);

                done();
            });
        });

        it('returns a helpful error when the config file contains a syntax error', function (done) {
            Lapidus.loadConfig('./test/config/invalid.json', function (err) {
                var output = spawnSync('node', ['index.js', '-c', './test/config/invalid.json']);

                assert.notEqual(err, null);
                assert.notEqual(output.stderr.toString().indexOf(err.message), -1);
                assert.notEqual(output.status, 0);

                done();
            });
        });
    });
});
