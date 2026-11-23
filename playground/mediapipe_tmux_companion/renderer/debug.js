import { gestureLabels } from '../shared/config.js';
import { gestureDefaults } from './gesture-gate.js';

const stateLabels = {
  READY: 'Ready', CANDIDATE: 'Recognizing', COOLDOWN: 'Cooldown', WAIT_FOR_RELEASE: 'Waiting for release',
  HOLDING: 'Holding gesture',
};

export function mountMediaPipeDebug(root, { onSetting } = {}) {
  const element = id => root.querySelector(`#${id}`);
  const settings = { ...gestureDefaults };
  const entries = [];
  const values = new Map();
  let visible = true;
  let latestResult;
  const freeze = element('freeze-output');
  const output = element('model-output');
  const resultMeta = element('result-meta');
  const log = element('diagnostic-log');

  function onUpdate(update) {
    for (const [id, value] of Object.entries(update)) {
      values.set(id, value);
      if (!visible) continue;
      const target = element(id);
      if (target && target.textContent !== value) target.textContent = value;
    }
  }

  function onDiagnostic(kind, data) {
    if (kind === 'result') {
      latestResult = data;
      if (visible) renderResult();
      return;
    }
    const message = kind === 'frame'
      ? `${data.label ?? 'No gesture'} (${(data.score ?? 0).toFixed(4)}) · ${data.previousState} → ${data.state} · ${data.decision}${data.action ? `: ${data.action}` : ''} · cooldown ${Math.ceil(data.cooldownRemainingMs)} ms`
      : data;
    entries.unshift(`[${new Date().toLocaleTimeString()}] ${message}`);
    if (entries.length > 100) entries.pop();
    if (visible) renderLog();
  }

  function renderResult() {
    if (!latestResult || freeze.checked) return;
    const { result, timestampMs, latencyMs } = latestResult;
    output.textContent = JSON.stringify(result, null, 2);
    resultMeta.textContent = 'Frame timestamp: ' + timestampMs.toFixed(1) + ' ms · Inference: ' + latencyMs.toFixed(1) + ' ms';
  }

  function renderLog() {
    log.textContent = entries.join('\n') || 'No events yet.';
  }

  freeze.addEventListener('change', renderResult);
  element('clear-log').addEventListener('click', () => {
    entries.length = 0;
    log.textContent = 'No events yet.';
  });

  for (const slider of root.querySelectorAll('input[data-gesture-setting]')) {
    const key = slider.dataset.gestureSetting;
    slider.addEventListener('input', () => {
      const value = slider.valueAsNumber;
      if (!Number.isFinite(value) || !slider.validity.valid || settings[key] === value) return;
      settings[key] = value;
      const displayed = key === 'confidence' ? value.toFixed(2) : key === 'cooldown' ? `${value} ms` : String(value);
      onUpdate({ [`${slider.id}-value`]: displayed });
      onDiagnostic('event', `${slider.labels[0].firstChild.textContent.trim()} set to ${displayed}`);
      onSetting?.(key);
    });
  }

  return {
    setVisible(next) {
      if (visible === next) return;
      visible = next;
      if (!visible) return;
      onUpdate(Object.fromEntries(values));
      renderLog();
      renderResult();
    },
    getSettings: () => settings,
    onUpdate,
    onDiagnostic,
    updateFrame({ label, score, hand }) {
      onUpdate({
        gesture: !hand ? 'No hand detected' : gestureLabels.includes(label) && score >= settings.confidence
          ? label : 'Unrecognized',
        confidence: label ? `${Math.round(score * 100)}%` : '—',
      });
    },
    renderGate({ state, frames, cooldownRemainingMs }) {
      onUpdate({
        state: stateLabels[state],
        progress: `${frames} / ${settings.frames} frames`,
        cooldown: `${(cooldownRemainingMs / 1000).toFixed(1)} s`,
      });
    },
    captureStatus(message, phase) {
      const active = phase === 'loading' || phase === 'on';
      onUpdate({ 'control-status': { starting: 'Starting…', loading: 'Loading model…', on: 'Enabled' }[phase] ?? 'Disabled',
        'preview-placeholder': active ? '' : phase === 'starting' ? 'Starting camera…' : 'Camera is off',
        'camera-error': phase === 'error' ? message : '' });
      if (phase === 'starting') {
        onUpdate({ 'last-action': 'None yet' });
      }
      if (!active) {
        onUpdate({ gesture: 'No hand detected', confidence: '—' });
      }
      onDiagnostic('event', message);
    },
  };
}
