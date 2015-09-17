var assert = require('assert');
var fizzbuzz = require('../');

describe('fizzbuzz', function() {
    it('returns null when passed a non-number', function() {
        assert.equal(fizzbuzz('abc'), null);
    });

    it('returns fizzbuzz when divisible by 15', function() {
        assert.equal(fizzbuzz(45), 'fizzbuzz');
    });

    it('returns fizz when divisible by 3 but not 5', function() {
        assert.equal(fizzbuzz(6), 'fizz');
    });

    it('returns buzz when divisble by 5 but not 3', function() {
        assert.equal(fizzbuzz(10), 'buzz');
    });

    it('returns input otherwise', function() {
        assert.equal(fizzbuzz(7), '7');
    });
});
