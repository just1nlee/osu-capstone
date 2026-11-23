const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDispatcher } = require('../electron/dispatch.cjs');
const { defaultMappings } = require('../shared/config.js');

function fixture(command, options = {}) {
  let time = 0;
  let context = {
    sessionId: '$0', activeWindowId: '@1', activePaneId: '%2', pid: '123', start: '100', created: '110', clients: [],
    windows: [{ id: '@1', panes: [{ id: '%2', index: 0, active: true }, { id: '%3', index: 1, active: false }] }],
  };
  const request = { gesture: 'Thumb_Up', targetToken: 'target', revision: 1, captureGeneration: 1 };
  const state = {
    sessions: { targetToken: 'target' },
    camera: { captureGeneration: 1, enabled: true, phase: 'on' },
    guardUnlocked: false, windowVisible: false,
  };
  const settings = { revision: 1, mappings: defaultMappings() };
  settings.mappings.gestures.Thumb_Up = { enabled: true, binding: { command, mode: 'guided', options, args: [] } };
  const actions = [];
  const metadata = new Map([[command, { name: command, usage: '[-t target-pane]' }]]);
  const tmux = {
    readContext: async () => context,
    runAction: async argv => { actions.push(argv); return ''; },
  };
  const dispatcher = createDispatcher({
    getState: () => state, getSession: () => ({ key: 'a' }), getMappings: () => settings,
    getCommands: async () => metadata, tmux, now: () => time,
  });
  const holdId = 'test-hold-id';
  return {
    state, settings, actions, tmux, request, dispatcher,
    setTime: value => { time = value; },
    setContext: value => { context = value; },
    getContext: () => context,
    dispatch: overrides => dispatcher.dispatch({ ...request, ...overrides }),
    hold: phase => dispatcher.dispatch({ ...request, phase, holdId }),
  };
}

test('FR-5: background dispatch works and rejects stale or disabled mappings', async () => {
  const f = fixture('select-pane');
  assert.equal((await f.dispatch({ captureGeneration: 2 })).code, 'stale_camera');
  assert.equal((await f.dispatch({ targetToken: 'old' })).code, 'stale_target');
  assert.equal((await f.dispatch({ revision: 0 })).code, 'stale_mapping');
  assert.equal((await f.dispatch({ gesture: 'Victory' })).code, 'disabled_gesture');
  assert.equal((await f.dispatch()).ok, true);
  f.settings.mappings.gestures.Thumb_Up.enabled = false;
  assert.equal((await f.dispatch()).code, 'disabled_gesture');
  assert.deepEqual(f.actions, [['select-pane', '-t', '$0:@1.+']]);
});

test('FR-8: guarded close requires the persistent checkbox, elapsed hold and original target', async () => {
  const f = fixture('kill-window');
  assert.equal((await f.hold('begin')).code, 'locked');
  f.state.guardUnlocked = true;
  assert.equal((await f.hold('begin')).ok, true);
  f.setTime(999);
  assert.equal((await f.hold('commit')).code, 'hold_required');
  f.setTime(1000);
  assert.equal((await f.hold('commit')).ok, true);
  assert.equal(f.actions[0][0], 'if-shell');
  assert.match(f.actions[0][4], /window_active/);
  assert.ok(f.actions[0].includes("kill-window -t '$0:@1'"));
  assert.equal(f.state.guardUnlocked, true);
  assert.equal((await f.hold('begin')).ok, true);
  f.setTime(2000);
  f.setContext({ ...f.getContext(), activePaneId: '%3' });
  assert.equal((await f.hold('commit')).code, 'stale_target');
  assert.equal(f.actions.length, 1);
});

test('FR-8: last pane is protected and a target lost during an async lookup cannot run an action', async () => {
  const f = fixture('kill-pane');
  f.state.guardUnlocked = true;
  f.setContext({ ...f.getContext(), windows: [{ id: '@1', panes: [{ id: '%2', active: true }] }] });
  assert.equal((await f.hold('begin')).code, 'last_pane');
  const g = fixture('select-pane');
  let unblock;
  g.tmux.readContext = () => new Promise(resolve => { unblock = resolve; });
  const first = g.dispatch();
  await new Promise(resolve => setImmediate(resolve));
  g.state.sessions.targetToken = 'other';
  unblock(g.getContext());
  assert.equal((await first).code, 'stale_target');
  assert.equal(g.actions.length, 0);
});

test('moves pin both pane IDs throughout the hold', async () => {
  const f = fixture('move-pane', { destination: 'next-window' });
  f.state.guardUnlocked = true;
  const context = f.getContext();
  assert.equal((await f.hold('begin')).code, 'second_window');
  f.setContext({ ...context, windows: [
    { ...context.windows[0], index: 0 },
    { id: '@4', index: 1, panes: [{ id: '%6', index: 0, active: true }] },
  ] });
  assert.equal((await f.hold('begin')).ok, true);
  f.setTime(1000);
  f.getContext().windows[1].panes[0].id = '%7';
  assert.equal((await f.hold('commit')).code, 'stale_target');
  assert.deepEqual(f.actions, []);
});
