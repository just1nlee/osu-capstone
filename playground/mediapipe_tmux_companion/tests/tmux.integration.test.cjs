const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { mkdtemp, rm, access } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createTmuxClient, resolveTmuxPath } = require('../electron/tmux.cjs');
const exec = promisify(execFile);

async function fixture(t) {
  const binary = process.env.TMUX_TEST_BINARY || await resolveTmuxPath();
  const folder = await mkdtemp(join(tmpdir(), 'companion-tmux-'));
  const socket = join(folder, 's');
  const tmux = createTmuxClient({ binary, socketArgs: ['-S', socket] });
  const raw = (...args) => exec(binary, ['-S', socket, ...args], { timeout: 4000 });
  t.after(async () => {
    await raw('-N', 'kill-server').catch(() => {});
    await rm(folder, { recursive: true, force: true });
  });
  return { tmux, raw, socket };
}

test('discovery and catalog never start a server and discover existing sessions after refresh', async t => {
  const { tmux, raw, socket } = await fixture(t);
  assert.deepEqual(await tmux.discover(), { status: 'empty', list: [] });
  await assert.rejects(tmux.listCommands(), { code: 'no_server' });
  await assert.rejects(access(socket), { code: 'ENOENT' });
  await raw('-f', '/dev/null', 'new-session', '-ds', 'work space');
  await raw('new-session', '-ds', 'side');
  const { list } = await tmux.discover();
  assert.deepEqual(list.map(row => row.name).sort(), ['side', 'work space']);
  assert.ok(list.every(row => row.attachedClients === 0));
  const work = list.find(row => row.name === 'work space');
  await raw('rename-session', '-t', work.sessionId, 'renamed');
  assert.equal((await tmux.discover()).list.find(row => row.name === 'renamed').key, work.key);
  const context = await tmux.readContext(work);
  assert.match(context.activeWindowId, /^@\d+$/);
  assert.match(context.activePaneId, /^%\d+$/);
  assert.ok((await tmux.listCommands()).some(row => row.name === 'move-pane'));
});

const { defaultMappings } = require('../shared/config.js');
const { createDispatcher, prepareMapping } = require('../electron/dispatch.cjs');

const binding = (command, options = {}, args = []) => ({ command, options, args, mode: args.length ? 'advanced' : 'guided' });

async function active(raw, session) {
  return (await raw('display-message', '-p', '-t', session + ':', '#{pane_id}')).stdout.trim();
}

test('real focus dispatch edits only the selected session and checked pane moves use distinct targets', async t => {
  const { tmux, raw } = await fixture(t);
  await raw('-f', '/dev/null', 'new-session', '-ds', 'work');
  await raw('new-session', '-ds', 'side');
  const sessions = (await tmux.discover()).list;
  const work = sessions.find(session => session.name === 'work');
  const side = sessions.find(session => session.name === 'side');
  await raw('split-window', '-h', '-t', work.sessionId + ':');
  await raw('split-window', '-h', '-t', side.sessionId + ':');
  await raw('new-window', '-d', '-t', work.sessionId + ':');
  const workBefore = await active(raw, work.sessionId);
  const sideBefore = await active(raw, side.sessionId);
  const commands = new Map((await tmux.listCommands()).map(metadata => [metadata.name, metadata]));
  const settings = { revision: 1, mappings: defaultMappings() };
  const state = { sessions: { targetToken: 'work' }, camera: { enabled: true, phase: 'on', captureGeneration: 1 }, guardUnlocked: true };
  let time = 0;
  const dispatcher = createDispatcher({
    getState: () => state, getSession: () => work, getMappings: () => settings, getCommands: () => commands,
    tmux, now: () => time,
  });
  const request = { gesture: 'Thumb_Up', targetToken: 'work', revision: 1, captureGeneration: 1 };
  settings.mappings.gestures.Thumb_Up = { enabled: true, binding: binding('select-pane') };
  assert.equal((await dispatcher.dispatch(request)).ok, true);
  assert.notEqual(await active(raw, work.sessionId), workBefore);
  assert.equal(await active(raw, side.sessionId), sideBefore);
  const command = 'move-pane';
  const panes = async () => (await raw('list-panes', '-s', '-t', work.sessionId, '-F', '#{window_id} #{pane_id}')).stdout;
  for (const destination of ['next-pane', 'next-window']) {
    const previous = await panes();
    const move = binding(command, { destination });
    const result = await prepareMapping({ tmux, session: work, metadata: commands.get(command), binding: move });
    assert.equal(result.ok, true, result.message);
    assert.equal(await panes(), previous, 'checking must leave the layout unchanged');
    settings.mappings.gestures.Thumb_Up.binding = move;
    const holdId = destination;
    assert.equal((await dispatcher.dispatch({ ...request, phase: 'begin', holdId })).ok, true);
    time += 1000;
    const dispatched = await dispatcher.dispatch({ ...request, phase: 'commit', holdId });
    assert.equal(dispatched.ok, true, dispatched.message);
    if (destination === 'next-window') {
      const [, targetWindow] = result.argv[4].match(/(@\d+)\./);
      assert.match(await panes(), new RegExp(targetWindow + ' ' + result.context.activePaneId));
    } else {
      assert.deepEqual((await panes()).trim().split('\n').sort(), previous.trim().split('\n').sort());
    }
  }
  const rename = binding('rename-window', { value: 'café window;' });
  const prepared = await prepareMapping({ tmux, session: work, metadata: commands.get('rename-window'), binding: rename });
  await tmux.runAction(prepared.argv);
  assert.equal((await raw('display-message', '-p', '-t', work.sessionId + ':', '#{window_name}')).stdout.trim(), 'café window;');
});

test('advanced pane targets are resolved before dispatch and headless errors keep their tmux detail', async t => {
  const { tmux, raw } = await fixture(t);
  await raw('-f', '/dev/null', 'new-session', '-ds', 'work');
  await raw('split-window', '-h');
  const session = (await tmux.discover()).list[0];
  const metadata = (await tmux.listCommands()).find(item => item.name === 'move-pane');
  const activePane = await active(raw, session.sessionId);
  const plan = await prepareMapping({ tmux, session, metadata, binding: binding('move-pane', {}, ['-hs' + activePane, '-t', '.+']) });
  assert.equal(plan.ok, true, plan.message);
  assert.match(plan.argv[1], /^-hs\$\d+:@\d+\.%\d+$/);
  assert.match(plan.argv[3], /^\$\d+:@\d+\.%\d+$/);
  assert.notEqual(plan.pin[0], plan.pin[1]);
  await assert.rejects(tmux.runAction(['move-pane']), /source and target panes must be different/);
});

test('in-server guard protects a last pane and cancels a close after focus changes', async t => {
  const { tmux, raw } = await fixture(t);
  await raw('-f', '/dev/null', 'new-session', '-ds', 'work');
  const work = (await tmux.discover()).list[0];
  const commands = new Map((await tmux.listCommands()).map(metadata => [metadata.name, metadata]));
  const settings = { revision: 1, mappings: defaultMappings() };
  settings.mappings.gestures.Thumb_Up = { enabled: true, binding: binding('kill-pane') };
  const state = { sessions: { targetToken: 'work' }, camera: { enabled: true, phase: 'on', captureGeneration: 1 }, guardUnlocked: true };
  let time = 0;
  let changeAtExec = false;
  const dispatcher = createDispatcher({
    getState: () => state, getSession: () => work, getMappings: () => settings, getCommands: () => commands,
    tmux: {
      ...tmux,
      async runAction(argv) {
        if (changeAtExec) await raw('select-pane', '-t', work.sessionId + ':.+');
        return tmux.runAction(argv);
      },
    },
    now: () => time,
  });
  const hold = phase => dispatcher.dispatch({ gesture: 'Thumb_Up', targetToken: 'work', revision: 1, captureGeneration: 1, holdId: 'close', phase });
  assert.equal((await hold('begin')).code, 'last_pane');
  await raw('split-window', '-h', '-t', work.sessionId + ':');
  assert.equal((await hold('begin')).ok, true);
  changeAtExec = true;
  time = 1000;
  assert.equal((await hold('commit')).code, 'stale_target');
  const paneCount = async () => (await raw('list-panes', '-t', work.sessionId + ':')).stdout.trim().split('\n').length;
  assert.equal(await paneCount(), 2);
  changeAtExec = false;
  assert.equal((await hold('begin')).ok, true);
  time = 2000;
  const close = await hold('commit');
  assert.equal(close.ok, true, close.message);
  assert.equal(await paneCount(), 1);
  await raw('new-window', '-t', work.sessionId + ':');
  settings.mappings.gestures.Thumb_Up.binding = binding('kill-window');
  assert.equal((await hold('begin')).ok, true);
  time = 3000;
  assert.equal((await hold('commit')).ok, true);
  assert.equal((await raw('list-windows', '-t', work.sessionId)).stdout.trim().split('\n').length, 1);
});

test('explicit cross-session pane targets are repinned during a guarded hold', async t => {
  const { tmux, raw } = await fixture(t);
  await raw('-f', '/dev/null', 'new-session', '-ds', 'work');
  await raw('new-session', '-ds', 'other');
  await raw('split-window', '-h', '-t', 'other:');
  const work = (await tmux.discover()).list.find(session => session.name === 'work');
  const settings = { revision: 1, mappings: defaultMappings() };
  settings.mappings.gestures.Thumb_Up = {
    enabled: true, binding: binding('swap-pane', {}, ['-s', 'other:.0', '-t', 'other:.1']),
  };
  const commands = new Map((await tmux.listCommands()).map(metadata => [metadata.name, metadata]));
  const state = { sessions: { targetToken: 'work' }, camera: { enabled: true, phase: 'on', captureGeneration: 1 }, guardUnlocked: true };
  let time = 0;
  const dispatcher = createDispatcher({
    getState: () => state, getSession: () => work, getMappings: () => settings, getCommands: () => commands,
    tmux, now: () => time,
  });
  const request = { gesture: 'Thumb_Up', targetToken: 'work', revision: 1, captureGeneration: 1, holdId: 'exact-panes' };
  assert.equal((await dispatcher.dispatch({ ...request, phase: 'begin' })).ok, true);
  await raw('swap-pane', '-s', 'other:.0', '-t', 'other:.1');
  time = 1000;
  assert.equal((await dispatcher.dispatch({ ...request, phase: 'commit' })).code, 'stale_target');
});
