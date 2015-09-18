var assert = require('assert'),
    Lapidus = require('../index.js'),
    spawnSync = require('child_process').spawnSync,
    fs = require('fs');

describe('Configuration File', function () {

    it('returns a helpful error when the file does not exist', function (done) {
        Lapidus.loadConfig('./test/config/a-way-off-the-island.json', function (err) {
            var output = spawnSync('node', ['index.js', '-c', './test/config/a-way-off-the-island.json', '-t']);

            assert.notEqual(err, null);
            assert.notEqual(output.stderr.toString().indexOf(err.message), -1);
            assert.notEqual(output.status, 0);

            done();
        });
    });

    it('returns a helpful error when we have insufficient permissions', function (done) {
        // Git doesn't like us committing files that we don't have read permissions to
        fs.writeFileSync('./test/config/forbidden.json', 'The Heart of the Island', { mode: 0o000, flag: 'w' });

        Lapidus.loadConfig('./test/config/forbidden.json', function (err) {
            var output = spawnSync('node', ['index.js', '-c', './test/config/forbidden.json', '-t']);

            assert.notEqual(err, null);
            assert.notEqual(output.stderr.toString().indexOf(err.message), -1);
            assert.notEqual(output.status, 0);

            fs.unlinkSync('./test/config/forbidden.json');

            done();
        });
    });

    it('returns a helpful error when the config file contains a syntax error', function (done) {
        Lapidus.loadConfig('./test/config/invalid.json', function (err) {
            var output = spawnSync('node', ['index.js', '-c', './test/config/invalid.json', '-t']);

            assert.notEqual(err, null);
            assert.notEqual(output.stderr.toString().indexOf(err.message), -1);
            assert.notEqual(output.status, 0);

            done();
        });
    });

    it('returns the configuration file on success', function (done) {
        Lapidus.loadConfig('./test/config/lapidus.json', function (err) {
            var output = spawnSync('node', ['index.js', '-c', './test/config/lapidus.json', '-t']);

            assert.ifError(err, null);
            assert.equal(output.status, 0);

            done();
        });
    });

    it('returns a helpful error when no backends are configured', function (done) {
        Lapidus.loadConfig('./test/config/no-backends.json', function (err) {
            var output = spawnSync('node', ['index.js', '-c', './test/config/no-backends.json', '-t']);

            assert.notEqual(err, null);
            assert.notEqual(output.stderr.toString().indexOf(err.message), -1);
            assert.notEqual(output.status, 0);

            done();
        });
    });

    it('returns a helpful error when a non-existant backend is configured', function (done) {
        Lapidus.loadConfig('./test/config/invalid-backend.json', function (err) {
            var output = spawnSync('node', ['index.js', '-c', './test/config/invalid-backend.json', '-t']);

            assert.notEqual(err, null);
            assert.notEqual(output.stderr.toString().indexOf(err.message), -1);
            assert.notEqual(output.status, 0);

            done();
        });
    });

});