var assert = require('assert'),
    Lapidus = require('../index.js'),
    spawnSync = require('child_process').spawnSync,
    fs = require('fs');

describe('MySQL', function () {
    var output;

    before(function(done) {
        output = spawnSync('node', ['index.js', '-c', './test/config/lapidus.json'], {timeout: 1000 });
        done();
    });

    it('connects to MySQL valid backends', function () {
        assert.equal(output.status, 0);
        assert.equal(output.stderr.toString(), '');
    });

    it('creates a lookup table of primary keys', function() {
        assert.notEqual(output.stdout.toString().indexOf('caching for fast lookups'), -1);
    });
});
