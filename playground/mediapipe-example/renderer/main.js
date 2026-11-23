import { startGestureControl, stopGestureControl, updateGestureSettings } from './gestures.js';

const colors = ['Red', 'Yellow', 'Blue', 'Green'];
const buttons = [...document.querySelectorAll('.color')];
const settings = { fps: 5, confidence: 0.70, frames: 2, cooldown: 1000 };
let selectedIndex = 0;
let activeColor = null;

function renderSelection() {
  buttons.forEach((button, index) => {
    button.classList.toggle('selected', index === selectedIndex);
    button.setAttribute('aria-pressed', String(index === selectedIndex));
  });
  document.body.dataset.color = activeColor?.toLowerCase() || '';
  document.querySelector('#active-color').textContent = `Background: ${activeColor || 'neutral'}`;
}
function moveSelection(direction) {
  selectedIndex = (selectedIndex + direction + colors.length) % colors.length;
  renderSelection();
}
function applySelection() {
  activeColor = colors[selectedIndex];
  renderSelection();
}
buttons.forEach((button, index) => button.addEventListener('click', () => {
  selectedIndex = index;
  applySelection();
}));
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    moveSelection(event.key === 'ArrowUp' ? -1 : 1);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    applySelection();
  }
});

const fields = [
  ['fps', 'fps'], ['confidence-setting', 'confidence'],
  ['frames', 'frames'], ['cooldown-setting', 'cooldown']
];
for (const [id, key] of fields) {
  const input = document.getElementById(id);
  input.addEventListener('input', () => {
    settings[key] = Number(input.value);
    document.getElementById(`${id}-value`).textContent = key === 'confidence' ? settings[key].toFixed(2) : key === 'cooldown' ? `${settings[key]} ms` : settings[key];
    updateGestureSettings(settings, key);
  });
}
const logEntries = [];
const logElement = document.querySelector('#diagnostic-log');
const outputElement = document.querySelector('#model-output');
const resultMeta = document.querySelector('#result-meta');
const freezeOutput = document.querySelector('#freeze-output');
function addDiagnostic(kind, data) {
  if (kind === 'result') {
    if (!freezeOutput.checked) {
      outputElement.textContent = JSON.stringify(data.result, null, 2);
      resultMeta.textContent = `Frame timestamp: ${data.timestampMs.toFixed(1)} ms · Inference: ${data.latencyMs.toFixed(1)} ms`;
    }
    return;
  }
  const time = new Date().toLocaleTimeString();
  const message = kind === 'frame'
    ? `${data.category || 'No gesture'} (confidence ${data.confidence.toFixed(4)}) · ${data.previousState} → ${data.state} · ${data.decision}${data.action ? `: ${data.action}` : ''} · cooldown ${Math.ceil(data.cooldownRemainingMs)} ms`
    : data;
  logEntries.unshift(`[${time}] ${message}`);
  if (logEntries.length > 100) logEntries.pop();
  logElement.textContent = logEntries.join('\n');
}
document.querySelector('#clear-log').addEventListener('click', () => {
  logEntries.length = 0;
  logElement.textContent = 'No events yet.';
});

const toggle = document.querySelector('#enabled');
toggle.addEventListener('change', async () => {
  if (toggle.checked) {
    await startGestureControl({ video: document.querySelector('#video'), settings,
      onDiagnostic: addDiagnostic,
      // Integration point for another Electron UI: map accepted gestures to that app's existing actions.
      // Keyboard, mouse, and gestures should all call the same actions instead of changing state separately.
      onAction: gesture => {
        if (gesture === 'Thumb_Up') { moveSelection(1); return 'Next selection'; }
        if (gesture === 'Thumb_Down') { moveSelection(-1); return 'Previous selection'; }
        applySelection(); return `Applied ${colors[selectedIndex]}`;
      },
      // Recognition details are renderer UI updates; they are separate from gesture-triggered actions.
      onUpdate: update => {
        for (const [id, value] of Object.entries(update)) {
          const element = document.getElementById(id);
          if (element) element.textContent = value;
        }
      },
      onError: message => { toggle.checked = false; document.querySelector('#error').textContent = message; }
    });
  } else stopGestureControl();
});
window.addEventListener('beforeunload', stopGestureControl);
renderSelection();
