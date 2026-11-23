import { createGestureCapture } from './gestures.js';
import { createGestureDispatch } from './gesture-gate.js';
import { mountMediaPipeDebug } from './debug.js';
import { mountSettings } from './settings.js';
import { poseNames } from '/shared/config.js';

const api = window.gestureCompanion;
const element = id => document.getElementById(id);
const picker = element('session-picker');
const toggle = element('camera-toggle');
const refresh = element('refresh-sessions');
const settings = mountSettings(element('settings'), api);
let state;
let captureGeneration;
let refreshing = false;
let renderedSessions = '';
const holds = new Map();
const debug = mountMediaPipeDebug(element('mediapipe'), { onSetting: () => gate.reset() });

const gate = createGestureDispatch({
  getBinding(label) {
    const row = state?.mappings?.gestures[label];
    return row?.enabled ? row.binding : null;
  },
  getSettings: debug.getSettings,
  canAct: () => state?.camera.phase === 'on' && Boolean(state.sessions.targetToken),
  canGuard: () => state?.guardUnlocked === true,
  onDecision: detail => debug.onDiagnostic('frame', detail),
  async onAction(gesture, phase, holdId) {
    let route = { targetToken: state.sessions.targetToken, revision: state.revision, captureGeneration };
    if (phase === 'begin') holds.set(holdId, route);
    if (phase === 'commit' || phase === 'cancel') {
      route = holds.get(holdId) ?? route;
      holds.delete(holdId);
    }
    let result;
    try {
      result = await api.dispatchGesture({ gesture, phase, holdId, ...route });
    } catch {
      result = { ok: false, message: 'Could not reach the companion to run the command.' };
    }
    if (phase === 'begin' && !result.ok) holds.delete(holdId);
    if (route.targetToken === state.sessions.targetToken && route.captureGeneration === state.camera.captureGeneration
        && route.revision === state.revision && phase !== 'cancel' && (!result.ok || phase !== 'begin')) {
      const message = poseNames[gesture] + ': ' + (result.ok ? result.command : result.message);
      debug.onUpdate({ 'last-action': message });
      debug.onDiagnostic('event', message);
    }
    return result;
  },
});

const capture = createGestureCapture(element('gesture-video'), {
  getFps: () => debug.getSettings().fps,
  onSample(sample) {
    debug.updateFrame(sample);
    void gate.sample(sample);
  },
  onTick(now) { debug.renderGate(gate.inspect(now)); },
  onDiagnostic: debug.onDiagnostic,
  onStatus(message, phase) {
    debug.captureStatus(message, phase);
    if (phase !== 'off') void api.reportCameraStatus({ captureGeneration, phase });
  },
});

function show(next) {
  if (next.ok === false || (state && next.sequence < state.sequence)) return;
  const previous = state;
  state = next;
  const { sessions, camera, windowVisible } = state;
  debug.setVisible(windowVisible);
  settings.render(state);
  if (previous && (previous.sessions.targetToken !== sessions.targetToken || previous.revision !== state.revision
      || previous.camera.enabled !== camera.enabled || previous.guardUnlocked !== state.guardUnlocked)) {
    gate.reset();
  }
  if (captureGeneration !== camera.captureGeneration) {
    captureGeneration = camera.captureGeneration;
    gate.reset();
    if (camera.enabled) void capture.start();
    else if (capture.isActive()) capture.stop();
  }
  const list = sessions.list;
  const label = sessions.status === 'loading' ? 'Checking for sessions…'
    : list.length ? 'Select a session' : 'No sessions available';
  const signature = JSON.stringify([label, list]);
  if (signature !== renderedSessions) {
    const placeholder = new Option(label, '');
    placeholder.disabled = true;
    const options = list.map(row => new Option(row.name + (row.attachedClients ? ' (attached)' : ' (detached)'), row.key));
    picker.replaceChildren(placeholder, ...options);
    renderedSessions = signature;
  }
  picker.value = sessions.selectedKey ?? '';
  picker.disabled = !list.length;
  const message = sessions.message || ({
    loading: 'Checking the tmux server.',
    empty: 'No tmux sessions found. Start tmux in your terminal, then refresh.',
    ready: sessions.selectedKey ? '' : 'Select the session that should receive gestures.',
    lost: 'The selected session ended. Refresh or choose another session to resume gestures.',
  })[sessions.status];
  element('session-message').textContent = message || '';
  const cameraStatus = element('camera-status');
  cameraStatus.textContent = ({ on: 'Camera on', loading: 'Loading model…', starting: 'Starting camera…' })[camera.phase] ?? 'Camera off';
  cameraStatus.dataset.active = String(camera.enabled);
  toggle.disabled = false;
  toggle.textContent = camera.enabled ? 'Turn camera off' : 'Turn camera on';
}

api.onStateChanged(show);
void api.getState().then(show);

picker.addEventListener('change', async () => {
  const reply = picker.value ? await api.selectSession(picker.value) : state;
  if (!reply.ok && reply !== state) element('session-message').textContent = reply.message;
  else show(reply);
});
refresh.addEventListener('click', async () => {
  if (refreshing) return;
  refreshing = refresh.disabled = true;
  try {
    show(await api.refreshSessions());
    void settings.refreshCatalog();
  } finally { refreshing = refresh.disabled = false; }
});
toggle.addEventListener('click', () => void api.setCameraEnabled(!state.camera.enabled));
window.addEventListener('beforeunload', () => { if (capture.isActive()) capture.stop(); });
