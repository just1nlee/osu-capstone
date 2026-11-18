import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCommandForm, prepareCommand, validateBindingOptions } from '../shared/commands.js';

const pane = (id, index, active) => ({ id, index, active });
const context = {
  sessionId: '$3', activeWindowId: '@2', activePaneId: '%7', clients: [],
  windows: [
    { id: '@2', index: 1, active: true, panes: [pane('%3', 1, false), pane('%7', 7, true)] },
    { id: '@4', index: 4, active: false, panes: [pane('%5', 0, true)] },
  ],
};
const guided = (command, options = {}) => ({ command, mode: 'guided', options, args: [] });
const advanced = (command, ...args) => ({ command, mode: 'advanced', options: {}, args });
const metadata = (name, usage = '') => ({ name, usage });
const move = metadata('move-pane', '[-bdfhv] [-l size] [-s src-pane] [-t dst-pane]');

test('FR-5/6/7: navigation automatically scopes to the selected session and explicit flags can override', () => {
  const select = metadata('select-pane', '[-DLRU] [-t target-pane]');
  assert.deepEqual(prepareCommand(select, guided('select-pane'), context).argv, ['select-pane', '-t', '$3:@2.+']);
  assert.deepEqual(prepareCommand(select, advanced('select-pane', '-Zt%3'), context).argv, ['select-pane', '-Zt%3']);
  assert.deepEqual(prepareCommand(metadata('new-window', '[-t target-window]'), guided('new-window'), context).argv,
    ['new-window', '-t', '$3:']);
  assert.deepEqual(prepareCommand(metadata('split-window', '[-t target-pane]'), guided('split-window'), context).argv,
    ['split-window', '-t', '$3:@2.%7']);
});

test('FR-7: guided moves pin two distinct pane IDs and report an unavailable destination', () => {
  assert.equal(getCommandForm(move, guided('move-pane')).fields[0].key, 'destination');
  assert.equal(validateBindingOptions(move, guided('move-pane')).code, 'required_input');
  const binding = guided('move-pane', { destination: 'next-window' });
  const result = prepareCommand(move, binding, context);
  assert.deepEqual(result.argv, ['move-pane', '-s', '$3:@2.%7', '-t', '$3:@4.%5']);
  assert.equal(result.guarded, true);
  assert.equal(prepareCommand(move, binding, { ...context, windows: context.windows.slice(0, 1) }).code, 'second_window');
  assert.deepEqual(prepareCommand(move, guided('move-pane', { destination: 'next-pane' }), context).argv,
    ['move-pane', '-s', '$3:@2.%7', '-t', '$3:@2.%3']);
  const onePane = { ...context.windows[0], panes: [pane('%7', 7, true)] };
  assert.equal(prepareCommand(move, guided('move-pane', { destination: 'next-pane' }),
    { ...context, windows: [onePane] }).code, 'second_pane');
  assert.equal(prepareCommand(move, advanced('move-pane', '-s%7', '-t', '%7'), context).code, 'same_pane');
  assert.equal(prepareCommand(move, advanced('move-pane', '-hv', '-t', '%5'), context).code, 'required_target');
});

test('required fields, real client targets, and direct close flags are validated before dispatch', () => {
  const rename = metadata('rename-window', '[-t target-window] new-name');
  assert.equal(prepareCommand(rename, guided('rename-window'), context).code, 'required_input');
  assert.deepEqual(prepareCommand(rename, guided('rename-window', { value: 'work name;' }), context).argv,
    ['rename-window', '-t', '$3:@2', 'work name;']);
  const client = metadata('switch-client', '[-c target-client] [-t target-session]');
  assert.equal(prepareCommand(client, guided('switch-client'), context).code, 'no_client');
  assert.equal(prepareCommand(client, guided('switch-client'), { ...context, clients: ['a', 'b'] }).code, 'ambiguous_client');
  assert.deepEqual(prepareCommand(client, guided('switch-client'), { ...context, clients: ['tty'] }).argv,
    ['switch-client', '-c', 'tty', '-t', '$3']);
  assert.equal(prepareCommand(metadata('kill-window'), advanced('kill-window', '-a'), context).code, 'close_flags');
  assert.equal(prepareCommand(metadata('attach-session'), guided('attach-session'), context).code, 'interactive_required');
});

test('a pane break pins the source and uses a free slot in the selected session', () => {
  const metadata = { name: 'break-pane', usage: '[-abd] [-s src-pane] [-t dst-window]' };
  assert.deepEqual(prepareCommand(metadata, guided('break-pane'), context).argv,
    ['break-pane', '-s', '$3:@2.%7', '-t', '$3:']);
  assert.deepEqual(prepareCommand(metadata, advanced('break-pane', '-t', '$3:6'), context).argv,
    ['break-pane', '-s', '$3:@2.%7', '-t', '$3:6']);
  assert.deepEqual(prepareCommand(metadata, advanced('break-pane', '-t6'), context).argv,
    ['break-pane', '-s', '$3:@2.%7', '-t$3:6']);
});

test('unspecified ambiguous targets are rejected instead of using tmux’s default target', () => {
  const metadata = { name: 'example-command', usage: '[-t target]' };
  assert.equal(prepareCommand(metadata, guided(metadata.name), context).code, 'required_target');
  assert.deepEqual(prepareCommand(metadata, advanced(metadata.name, '-t%7'), context).argv, [metadata.name, '-t%7']);
});
