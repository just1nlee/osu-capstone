const assert = require('node:assert/strict');
const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { test } = require('node:test');
const { createAssetHandler, modelUrl, sharedModelPath } = require('../electron/protocol.cjs');

test('the default model comes from the same repository file as the Python test harness', () => {
  assert.equal(sharedModelPath, resolve(__dirname, '../../../test-model/models/gesture_recognizer.task'));
});

test('NFR-5: only the fixed model route reads the external file and absence has no fallback', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'companion-model-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const model = join(directory, 'gesture_recognizer.task');
  const handler = createAssetHandler(model);
  const head = () => handler(new Request(modelUrl, { method: 'HEAD' }));
  assert.equal((await head()).status, 404);
  assert.equal((await handler(new Request(modelUrl))).status, 404);
  assert.equal((await handler(new Request('gesture://app/index.html'))).status, 200);

  await writeFile(model, 'test model bytes');
  await writeFile(join(directory, 'adjacent.task'), 'unrelated test bytes');
  assert.equal((await head()).status, 200);
  assert.equal(await (await head()).text(), '');
  const asset = await handler(new Request(modelUrl));
  assert.equal(asset.headers.get('cache-control'), 'no-store');
  assert.equal(await asset.text(), 'test model bytes');
  assert.equal((await handler(new Request('gesture://app/models/adjacent.task'))).status, 404);
  assert.equal((await handler(new Request('gesture://other/models/gesture_recognizer.task'))).status, 404);
  assert.equal((await handler(new Request(modelUrl, { method: 'POST' }))).status, 405);
});
