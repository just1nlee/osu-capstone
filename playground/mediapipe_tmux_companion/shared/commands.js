const reviewed = new Set([
  'select-pane', 'last-pane', 'select-window', 'last-window', 'next-window', 'previous-window',
  'split-window', 'new-window', 'next-layout', 'previous-layout', 'select-layout',
  'list-sessions', 'list-windows', 'list-panes', 'list-clients',
]);
const closes = new Map([['kill-pane', 'pane'], ['kill-window', 'window'], ['kill-session', 'session']]);
const movingPanes = new Set(['move-pane', 'join-pane']);
const newWindowSlots = new Set(['new-window', 'break-pane', 'move-window', 'link-window']);
const movingWindows = new Set(['move-window', 'link-window', 'swap-window']);
const destinations = [
  ['next-pane', 'Next pane in this window'],
  ['next-window', 'Next window’s active pane'],
  ['previous-window', 'Previous window’s active pane'],
];

const fail = (code, message) => ({ ok: false, code, message });
const fieldLabel = name => name.charAt(0).toUpperCase() + name.slice(1).replaceAll('-', ' ');
export const isGuardedBinding = binding => Boolean(binding
  && (binding.mode !== 'guided' || !reviewed.has(binding.command)));

function readUsage(usage = '') {
  const values = new Map();
  for (const [, flag, value] of usage.matchAll(/\[-([a-zA-Z])\s+([a-z][a-z0-9-]*)\]/g)) values.set(flag, value);
  let depth = 0;
  let required = '';
  for (const character of usage) {
    if (character === '[') depth++;
    else if (character === ']') depth = Math.max(depth - 1, 0);
    else if (!depth) required += character;
  }
  return { values, positional: required.trim().split(/\s+/).filter(Boolean) };
}

function parseOptions(args, values) {
  const flags = new Map();
  const flagLocations = new Map();
  let index = 0;
  for (; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--') { index++; break; }
    if (!/^-[a-zA-Z]/.test(argument)) break;
    for (let offset = 1; offset < argument.length; offset++) {
      const flag = argument[offset];
      if (values.has(flag)) {
        const inline = argument.slice(offset + 1);
        const value = inline || args[++index];
        if (!value) return fail('required_input', 'Add a value for -' + flag + '.');
        flags.set(flag, value);
        flagLocations.set(flag, { index, prefix: inline ? argument.slice(0, offset + 1) : '' });
        break;
      }
      flags.set(flag, true);
    }
  }
  return { ok: true, flags, flagLocations, positionals: args.slice(index) };
}

function commandUsage(metadata, binding) {
  const { values, positional } = readUsage(metadata?.usage);
  const { command } = binding;
  if (movingPanes.has(command)) {
    values.set('s', 'src-pane');
    values.set('t', 'dst-pane');
  } else if (command === 'break-pane') {
    values.set('s', 'src-pane');
    values.set('t', 'dst-window');
  } else if (command === 'swap-pane') {
    values.set('s', 'src-pane');
    values.set('t', 'dst-pane');
  } else if (movingWindows.has(command)) {
    values.set('s', 'src-window');
    values.set('t', 'dst-window');
  } else if (closes.has(command)) {
    values.set('t', 'target-' + closes.get(command));
  } else if (command === 'list-panes' && (!values.has('t') || values.get('t') === 'target')) {
    values.set('t', 'target-window');
  }
  if ((command === 'rename-window' || command === 'rename-session') && !positional.length) {
    positional.push('new-name');
  }
  if (command === 'run-shell' && !positional.length) positional.push('shell-command');
  return { values, positional };
}

export function getCommandForm(metadata, binding) {
  if (!binding) return { fields: [], advancedRequired: false };
  if (movingPanes.has(binding.command)) {
    return { fields: [{ key: 'destination', label: 'Destination', choices: destinations }], advancedRequired: false };
  }
  if (movingWindows.has(binding.command) || binding.command === 'swap-pane') {
    return { fields: [], advancedRequired: true };
  }
  const { positional, values } = commandUsage(metadata, binding);
  if ([...values.values()].includes('target')) return { fields: [], advancedRequired: true };
  if (positional.length === 1 && /^[a-z][\w-]*$/.test(positional[0])) {
    return { fields: [{ key: 'value', label: fieldLabel(positional[0]) }], advancedRequired: false };
  }
  return { fields: [], advancedRequired: positional.length > 0 };
}

export function validateBindingOptions(metadata, binding) {
  const { command, mode, options, args } = binding;
  if (closes.has(command) && args.length) {
    return fail('close_flags', 'This close command uses the current selected target and accepts no arguments.');
  }
  const { values, positional } = commandUsage(metadata, binding);
  const ambiguous = [...values].filter(([, kind]) => kind === 'target').map(([flag]) => flag);
  const missingTarget = () => fail('required_target', 'Specify the target in Advanced options.');
  if (mode === 'guided') {
    if (ambiguous.length) return missingTarget();
    const { fields, advancedRequired } = getCommandForm(metadata, binding);
    if (advancedRequired) return fail('required_input', 'Fill in the required arguments in Advanced options.');
    if (Object.keys(options).some(key => !fields.some(field => field.key === key))) {
      return fail('invalid_options', 'These options do not apply to this command.');
    }
    for (const { key, label, choices } of fields) {
      const value = options[key];
      if (!value?.trim() || (choices && !choices.some(([option]) => option === value))) {
        return fail('required_input', 'Choose or enter ' + label.toLowerCase() + '.');
      }
    }
    return { ok: true };
  }
  const parsed = parseOptions(args, values);
  if (!parsed.ok) return parsed;
  const { flags, positionals } = parsed;
  if (ambiguous.some(flag => !flags.has(flag))) return missingTarget();
  if (positionals.filter(value => value.trim()).length < positional.length) {
    return fail('required_input', 'Fill in ' + positional.join(' and ') + ' in Advanced options.');
  }
  const floatingMove = command === 'move-pane' && [...'DLPRUXYz'].some(flag => values.has(flag) && flags.has(flag));
  const relativeSwap = command === 'swap-pane' && (flags.has('D') || flags.has('U'));
  const renumber = command === 'move-window' && flags.has('r');
  if (!floatingMove && !relativeSwap && !renumber
      && (movingPanes.has(command) || movingWindows.has(command) || command === 'swap-pane')) {
    if (!flags.has('s') || !flags.has('t')) return fail('required_target', 'Specify both -s (source) and -t (destination).');
    if (flags.get('s') === flags.get('t') && !movingWindows.has(command)) {
      return fail('same_pane', 'Choose a different destination pane.');
    }
  }
  return { ok: true };
}

function nextItem(items, currentId, direction = 1) {
  const ordered = [...items].sort((a, b) => a.index - b.index);
  const current = ordered.findIndex(item => item.id === currentId);
  if (ordered.length < 2 || current < 0) return null;
  return ordered[(current + direction + ordered.length) % ordered.length];
}

export function needsClientContext(metadata, binding) {
  return [...commandUsage(metadata, binding).values.values()].includes('target-client');
}

export function prepareCommand(metadata, binding, context) {
  if (!metadata || metadata.name !== binding.command) return fail('unknown_command', 'This command is unavailable on the current tmux server.');
  const valid = validateBindingOptions(metadata, binding);
  if (!valid.ok) return valid;
  const { command, mode, options } = binding;
  const { sessionId, activeWindowId, activePaneId, windows, clients } = context;
  const window = windows.find(item => item.id === activeWindowId);
  const windowTarget = sessionId + ':' + activeWindowId;
  const paneTarget = windowTarget + '.' + activePaneId;
  const guarded = isGuardedBinding(binding);
  const success = (args, target = paneTarget, extra) => ({ ok: true, argv: [command, ...args], target, guarded, ...extra });

  if (command === 'attach-session') {
    return fail('interactive_required', 'Run this command from an interactive tmux terminal.');
  }
  if (closes.has(command)) {
    const scope = closes.get(command);
    if (scope === 'pane' && window?.panes.length < 2) return fail('last_pane', 'The only pane in a window is protected.');
    const target = { pane: paneTarget, window: windowTarget, session: sessionId }[scope];
    return success(['-t', target], target, { close: scope });
  }
  if (mode === 'guided' && movingPanes.has(command)) {
    const destination = options.destination;
    const targetWindow = destination === 'next-pane' ? window
      : nextItem(windows, activeWindowId, destination === 'previous-window' ? -1 : 1);
    if (!targetWindow) return fail('second_window', 'This session needs a second window.');
    const pane = destination === 'next-pane' ? nextItem(targetWindow.panes, activePaneId)
      : targetWindow.panes.find(item => item.active);
    if (!pane) return fail('second_pane', 'This window needs a second pane.');
    if (pane.id === activePaneId) return fail('same_pane', 'Choose a different destination pane.');
    const target = sessionId + ':' + targetWindow.id + '.' + pane.id;
    return success(['-s', paneTarget, '-t', target], paneTarget + ' → ' + target, { pin: [activePaneId, pane.id] });
  }
  if (mode === 'guided' && command === 'select-pane') {
    if (window?.panes.length < 2) return fail('second_pane', 'This window needs a second pane.');
    return success(['-t', windowTarget + '.+'], windowTarget + '.+');
  }

  const args = mode === 'advanced' ? [...binding.args] : options.value === undefined ? [] : [options.value];
  const { values } = commandUsage(metadata, binding);
  const { flags, flagLocations } = parseOptions(mode === 'advanced' ? args : [], values);
  const prefix = [];
  const explicitTargets = [];
  let target = null;
  if (command === 'break-pane' && !flags.has('s')) {
    if (window?.panes.length < 2) return fail('second_pane', 'This window needs a second pane to break one out.');
    prefix.push('-s', paneTarget);
  }
  if (command === 'new-session' && mode === 'guided') prefix.push('-d');
  for (const [flag, kind] of values) {
    if (kind === 'target') {
      target ??= String(flags.get(flag));
      continue;
    }
    const scope = kind.match(/^(?:target|dst|src)-(pane|window|session|client)$/)?.[1];
    if (!scope) continue;
    if (flags.has(flag)) {
      const value = String(flags.get(flag));
      const isWindowSlot = flag === 't' && scope === 'window' && newWindowSlots.has(command);
      const resolved = isWindowSlot && !value.includes(':') ? sessionId + ':' + value : value;
      if (!kind.startsWith('src-')) target = resolved;
      if (resolved !== value) {
        const { index, prefix: inline } = flagLocations.get(flag);
        args[index] = inline + resolved;
      }
      if (scope !== 'client' && !isWindowSlot && !(command === 'new-session' && flag === 't')) {
        explicitTargets.push({ flag, scope, value });
      }
      continue;
    }
    if (kind.startsWith('src-') || (flag === 's' && kind === 'target-session')) continue;
    if (command === 'new-session' && flag === 't') continue;
    if (kind === 'target-client') {
      if ((command === 'display-message' && flags.has('p'))
          || (command === 'detach-client' && flags.has('s'))) continue;
      if (!clients.length) return fail('no_client', 'Attach a tmux terminal client to this session first.');
      if (clients.length > 1) return fail('ambiguous_client', 'Multiple clients are attached. Specify a client in Advanced options.');
      prefix.push('-' + flag, clients[0]);
      target ??= clients[0];
      continue;
    }
    // Relative swap and window renumbering have a meaningful default destination.
    const value = {
      pane: paneTarget,
      window: newWindowSlots.has(command) ? sessionId + ':' : windowTarget,
      session: sessionId,
    }[scope];
    prefix.push('-' + flag, value);
    target = value;
  }
  if (mode === 'guided' && args[0]?.startsWith('-')) prefix.push('--');
  const serverWide = !target && ![...values.values()].some(kind => kind.startsWith('target-'));
  const references = explicitTargets.map(({ flag, scope, value }) => {
    const { index, prefix: inline } = flagLocations.get(flag);
    return { scope, index: 1 + prefix.length + index, prefix: inline, target: value };
  });
  return success([...prefix, ...args], target || (serverWide ? 'tmux server' : paneTarget), { serverWide, references });
}
