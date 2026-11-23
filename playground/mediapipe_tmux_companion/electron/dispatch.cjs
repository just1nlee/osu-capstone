const { gestureLabels, guardHoldMs } = require('../shared/config.js');
const { prepareCommand, isGuardedBinding, needsClientContext, validateBindingOptions } = require('../shared/commands.js');

const fail = (code, message) => ({ ok: false, code, message });
const staleTarget = () => fail('stale_target', 'The selected session or target changed. Try the gesture again.');
const staleMarker = '__companion_stale_close_target__';
const unexpected = error => fail(error.code || 'unexpected', error.message || 'tmux could not run the command.');

async function prepareMapping({ tmux, session, metadata, binding, signal }) {
  if (!metadata) return fail('unknown_command', 'This command is unavailable on the current tmux server.');
  const valid = validateBindingOptions(metadata, binding);
  if (!valid.ok) return valid;
  const context = await tmux.readContext(session, signal, { includeClients: needsClientContext(metadata, binding) });
  const result = prepareCommand(metadata, binding, context);
  if (!result.ok) return result;
  if (result.references?.length) {
    const targets = await Promise.all(result.references.map(({ scope, target }) => tmux.readTarget(scope, target, context, signal)));
    if (['move-pane', 'join-pane', 'swap-pane'].includes(binding.command)
        && targets.length === 2 && targets[0].pane === targets[1].pane) {
      return fail('same_pane', 'Choose a different destination pane.');
    }
    result.pin = targets.map(({ target }, index) => {
      const reference = result.references[index];
      result.argv[reference.index] = reference.prefix + target;
      return target;
    });
    result.target = result.pin.join(' → ');
  }
  return { ...result, context };
}

function closeCommand({ context, argv, close }) {
  const { sessionId, activeWindowId, activePaneId, pid, start, created } = context;
  const identifiers = [[sessionId, /^\$\d+$/], [activeWindowId, /^@\d+$/], [activePaneId, /^%\d+$/],
    [pid, /^\d+$/], [start, /^\d+$/], [created, /^\d+$/]];
  if (!identifiers.every(([value, pattern]) => pattern.test(value ?? ''))) return null;
  const paneTarget = sessionId + ':' + activeWindowId + '.' + activePaneId;
  const closeTarget = { pane: paneTarget, window: sessionId + ':' + activeWindowId, session: sessionId }[close];
  const values = [
    ['session_id', sessionId], ['window_id', activeWindowId], ['pane_id', activePaneId],
    ['window_active', '1'], ['pane_active', '1'], ['pid', pid], ['start_time', start], ['session_created', created],
  ];
  const conditions = values.map(([key, value]) => '#{==:#{' + key + '},' + value + '}');
  if (close === 'pane') conditions.push('#{>:#{window_panes},1}');
  const format = conditions.reduce((a, b) => '#{&&:' + a + ',' + b + '}');
  return ['if-shell', '-F', '-t', paneTarget, format, argv[0] + " -t '" + closeTarget + "'",
    'display-message -p ' + staleMarker];
}

function targetIdentity({ context, argv, pin }) {
  const { sessionId, activeWindowId, activePaneId, pid, start, created } = context;
  return JSON.stringify([sessionId, activeWindowId, activePaneId, pid, start, created, argv, pin]);
}

function createDispatcher({ getState, getSession, getMappings, getCommands, tmux, now = () => performance.now() }) {
  let hold;
  let busy = false;

  function cancelPending() { hold = undefined; }

  function eligibility(request) {
    const state = getState();
    const store = getMappings();
    if (!state.sessions.targetToken || state.sessions.targetToken !== request.targetToken || !getSession()) return staleTarget();
    if (store.revision !== request.revision) return fail('stale_mapping', 'The saved gesture mappings changed.');
    if (!state.camera.enabled || state.camera.phase !== 'on' || state.camera.captureGeneration !== request.captureGeneration) {
      return fail('stale_camera', 'Gesture recognition is off or still starting.');
    }
    const row = store.mappings.gestures[request.gesture];
    if (!row.enabled || !row.binding) return fail('disabled_gesture', 'This gesture has no enabled command.');
    if (isGuardedBinding(row.binding) && !state.guardUnlocked) return fail('locked', 'Enable the guard checkbox to run this command.');
    return { ok: true, binding: row.binding, session: getSession() };
  }

  async function dispatch(request) {
    if (!gestureLabels.includes(request?.gesture)) return fail('invalid_gesture', 'This gesture is unavailable.');
    const { phase, holdId } = request;
    const identity = JSON.stringify([holdId, request.gesture, request.targetToken, request.revision, request.captureGeneration]);
    if (phase === 'cancel') {
      if (hold?.identity === identity) cancelPending();
      return { ok: true };
    }
    const eligible = eligibility(request);
    if (!eligible.ok) return eligible;
    const { binding, session } = eligible;
    const guarded = isGuardedBinding(binding);
    const started = now();
    if (guarded) {
      if (typeof holdId !== 'string' || !holdId || holdId.length > 128 || !['begin', 'commit'].includes(phase)) {
        return fail('hold_required', 'Hold this gesture for one second.');
      }
      if (phase === 'commit' && (hold?.identity !== identity || !hold.target || started - hold.started < guardHoldMs)) {
        return fail('hold_required', 'Hold this gesture for one second.');
      }
    } else if (phase !== undefined) return fail('invalid_phase', 'This gesture does not use a hold.');
    if (busy) return fail('busy', 'Another tmux action is still running.');
    busy = true;
    const attempt = guarded && phase === 'begin' ? { identity, started } : hold;
    if (guarded && phase === 'begin') hold = attempt;
    try {
      const commands = await getCommands(session);
      const plan = await prepareMapping({ tmux, session, metadata: commands.get(binding.command), binding });
      const current = eligibility(request);
      if (!current.ok) return current;
      if (!plan.ok) return plan;
      if (guarded) {
        if (hold !== attempt) return fail('hold_cancelled', 'The hold was cancelled.');
        const target = targetIdentity(plan);
        if (phase === 'begin') {
          attempt.target = target;
          return { ok: true };
        }
        if (target !== attempt.target) return staleTarget();
      }
      const argv = plan.close ? closeCommand(plan) : plan.argv;
      if (!argv) return staleTarget();
      const output = await tmux.runAction(argv);
      if (plan.close && output.trim() === staleMarker) return staleTarget();
      return { ok: true, command: binding.command };
    } catch (error) {
      if (error.code === 'no_server' || error.code === 'stale_target') return staleTarget();
      return unexpected(error);
    } finally {
      if (guarded && hold === attempt && (phase === 'commit' || !attempt.target)) cancelPending();
      busy = false;
    }
  }

  return { dispatch, cancelPending };
}

module.exports = { createDispatcher, prepareMapping };
