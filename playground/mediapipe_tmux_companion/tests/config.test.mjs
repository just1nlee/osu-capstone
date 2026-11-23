import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, unlink, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { defaultMappings, gestureLabels, validateMappings } from '../shared/config.js';
import { openSettings } from '../electron/settings.cjs';

const binding = { command: 'select-pane', mode: 'guided', options: {}, args: [] };

test('FR-15: one unassigned, disabled row per gesture, with shared commands and retained disabled bindings', () => {
  const value = defaultMappings();
  assert.deepEqual(Object.keys(value.gestures), gestureLabels);
  assert.equal(gestureLabels.length, 7);
  assert.ok(Object.values(value.gestures).every(row => !row.enabled && row.binding === null));
  value.gestures.Thumb_Up = { enabled: true, binding };
  value.gestures.Thumb_Down = { enabled: false, binding };
  assert.deepEqual(validateMappings(value).mappings, value);
  value.gestures.Victory.enabled = true;
  assert.equal(validateMappings(value).ok, false);
});

test('FR-15: persisted toggles survive reopen and a failed write keeps the prior live revision', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'companion-settings-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = join(directory, 'gesture-mappings.v1.json');
  await writeFile(filename, '{broken');
  const store = await openSettings(directory);
  assert.ok(store.read().notice);
  assert.equal(await readFile(filename, 'utf8'), '{broken');
  const value = defaultMappings();
  value.gestures.Victory = { enabled: false, binding };
  const saved = await store.save(value);
  assert.equal(saved.ok, true);
  assert.deepEqual((await openSettings(directory)).read().mappings, value);
  await unlink(filename);
  await mkdir(filename);
  assert.equal((await store.save(defaultMappings())).ok, false);
  assert.deepEqual(store.read().mappings, value);
  assert.equal(store.read().revision, saved.revision);
});

test('saved commands must be names, not values coerced to names', () => {
  const value = defaultMappings();
  value.gestures.Thumb_Up = { enabled: true, binding: { ...binding, command: ['select-pane'] } };
  assert.equal(validateMappings(value).ok, false);
});
