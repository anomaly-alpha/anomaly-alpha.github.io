'use strict';

var assert = require('assert');
var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

var rootDir = path.resolve(__dirname, '..');

childProcess.execFileSync(process.execPath, ['scripts/generate-codes.js'], {
  cwd: rootDir,
  stdio: 'ignore'
});

var indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
var match = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);

assert.ok(match, 'Homepage should contain JSON-LD');
assert.doesNotThrow(function () {
  JSON.parse(match[1]);
}, 'Generated homepage JSON-LD should be valid JSON');

console.log('Promo-code generator tests passed.');
