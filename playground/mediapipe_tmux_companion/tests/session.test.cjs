const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessionSelection } = require('../electron/session-selection.cjs');

const row = (key, name = key) => ({ key, name, attachedClients: 0 });
const snapshot = (...list) => ({ status: list.length ? 'ready' : 'empty', list });

test('zero sessions can be refreshed into one automatic selection', () => {
  const selection = createSessionSelection();
  assert.equal(selection.applyDiscovery(snapshot()).status, 'empty');
  const state = selection.applyDiscovery(snapshot(row('first')));
  assert.equal(state.selectedKey, 'first');
  assert.ok(state.targetToken);
});

test('multiple sessions require selection and keep it through renames and additions', () => {
  const selection = createSessionSelection();
  assert.equal(selection.applyDiscovery(snapshot(row('a'), row('b'))).selectedKey, null);
  assert.equal(selection.select('unknown'), null);
  const state = selection.select('b');
  const renamed = selection.applyDiscovery(snapshot(row('b', 'renamed'), row('a'), row('c')));
  assert.equal(renamed.selectedKey, 'b');
  assert.equal(renamed.targetToken, state.targetToken);
  assert.equal(renamed.list[0].name, 'renamed');
});

test('loss, including restart reusing a name and ID, requires explicit selection', () => {
  const selection = createSessionSelection();
  const original = selection.applyDiscovery(snapshot(row('old:$0', 'work')));
  const after = selection.applyDiscovery(snapshot(row('new:$0', 'work')));
  assert.equal(after.status, 'lost');
  assert.equal(after.targetToken, null);
  assert.equal(selection.applyDiscovery(snapshot(row('new:$0', 'work'))).selectedKey, null);
  assert.notEqual(selection.select('new:$0').targetToken, original.targetToken);
});

test('a failed refresh pauses dispatch and reports the error', () => {
  const selection = createSessionSelection();
  selection.applyDiscovery(snapshot(row('work')));
  const result = selection.applyDiscovery({ status: 'error', message: 'Permission denied', list: [] });
  assert.equal(result.status, 'error');
  assert.equal(result.targetToken, null);
  assert.equal(result.message, 'Permission denied');
});
