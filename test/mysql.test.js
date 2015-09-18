var assert = require('assert'),
    Lapidus = require('../index.js'),
    spawnSync = require('child_process').spawnSync,
    fs = require('fs');

describe('MySQL', function () {

    it('connects to MySQL valid backends', function (done) {
        var output = spawnSync('node', ['index.js', '-c', './test/config/lapidus.json'], {timeout: 10000});

        console.log(output.stdout.toString());
        console.error(output.stderr.toString());
        assert.equal(output.status, 0);

        done();
    });
});
