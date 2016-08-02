suite('End to End', () => {
  let assert = require('assert');
  let documenter = require('../');
  let debug = require('debug')('test');
  let _ = require('lodash');
  let tar = require('tar-stream');
  let rootdir = require('app-root-dir');
  let zlib = require('zlib');
  let validator = require('taskcluster-lib-validate');
  let base = require('taskcluster-base');

  let validate = null;
  let api = null;
  let exchanges = null;
  let references = null;
  let cfg = base.config();
  let credentials = cfg.taskcluster.credentials;
  let tier = 'core';

  suiteSetup(async () => {
    validate = await validator({
      folder: './test/schemas',
      baseUrl: 'http://localhost:1203/',
      constants: {'my-constant': 42},
    });
    api = new base.API({
      title: 'Testing Stuff',
      description: 'This is for testing stuff!',
    });
    exchanges = new base.Exchanges({
      title: 'Testing Stuff Again',
      description: 'Another test!',
    });
    references = [
      {name: 'api', reference: api.reference({baseUrl: 'http://localhost'})},
      {name: 'events', reference: exchanges.reference({baseUrl: 'http://localhost'})},
    ];
  });

  function assertInTarball(shoulds, tarball, done) {
    let contains = [];
    let extractor = tar.extract();
    extractor.on('entry', (header, stream, callback) => {
      stream.on('end', () => {
        contains.push(header.name);
        callback(); // ready for next entry
      });

      stream.resume(); // just auto drain the stream
    });

    extractor.on('finish', function() {
      done(assert.deepEqual(contains.sort(), shoulds.sort()));
    });

    tarball.pipe(zlib.Unzip()).pipe(extractor);
  }

  test('tarball exists', async function() {
    let doc = await documenter({
      schemas: validate.schemas,
      tier,
    });
    assert.ok(doc.tgz);
  });

  test('tarball is empty but exists', function() {
    let doc = documenter({
      tier,
    });
    assert.equal(doc.tgz, null);
  });

  test('test publish tarball', async function() {
    let doc = await documenter({
      project: 'testing',
      schemas: validate.schemas,
      tier,
      credentials,
      docsFolder: './test/docs/',
      references,
      publish: true,
    });
    assert.ok(doc.tgz);
  });

  test('tarball contains docs and metadata', async function(done) {
    let doc = await documenter({
      docsFolder: './test/docs',
      tier,
    });
    let shoulds = [
      'taskcluster-lib-docs/docs/example.md',
      'taskcluster-lib-docs/metadata.json',
    ];
    assertInTarball(shoulds, doc.tgz, done);
  });

  test('tarball contains schemas and metadata', async function(done) {
    let doc = await documenter({
      schemas: validate.schemas,
      tier,
    });
    let shoulds = [
      'taskcluster-lib-docs/schema/foo.json',
      'taskcluster-lib-docs/schema/bar.json',
      'taskcluster-lib-docs/metadata.json',
    ];
    assertInTarball(shoulds, doc.tgz, done);
  });

  test('tarball contains references and metadata', async function(done) {
    let doc = await documenter({
      references,
      tier,
    });
    let shoulds = [
      'taskcluster-lib-docs/references/api.json',
      'taskcluster-lib-docs/references/events.json',
      'taskcluster-lib-docs/metadata.json',
    ];
    assertInTarball(shoulds, doc.tgz, done);
  });

  test('tarball contains only metadata', async function(done) {
    let doc = await documenter({
      tier,
    });
    let shoulds = [
      'taskcluster-lib-docs/metadata.json',
    ];
    assertInTarball(shoulds, doc.tgz, done);
  });
});
