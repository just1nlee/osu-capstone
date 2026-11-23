const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const electron = require('electron');

let app;
let socket;
let nextId = 0;
const pending = new Map();

// Run the same Electron app as npm start. DevTools lets the test inspect the UI
// without enabling Node integration or requiring a webcam.
async function evaluate(expression) {
  const id = ++nextId;
  const response = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  const result = await response;
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

before(async () => {
  app = spawn(electron, ['.', '--remote-debugging-port=0'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  let port;
  app.stderr.on('data', chunk => { stderr += chunk; });
  const deadline = Date.now() + 30000;
  let target;
  while (Date.now() < deadline) {
    if (app.exitCode !== null) throw new Error(`Electron exited early: ${stderr}`);
    port ||= /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(stderr)?.[1];
    if (port) {
      const targets = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
      target = targets.find(item => item.type === 'page' && item.url === 'gesture://app/index.html');
      if (target) break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!target) throw new Error(`Electron window did not load: ${stderr}`);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (request) {
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });
  while (Date.now() < deadline) {
    if (await evaluate("Boolean(document.querySelector('.color.selected'))")) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Renderer did not initialize: ${stderr}`);
});

after(async () => {
  if (socket?.readyState === WebSocket.OPEN) {
    await evaluate('window.close()').catch(() => {});
    socket.close();
  }
  if (app && app.exitCode === null) app.kill();
});

test('keyboard navigation wraps without applying a color', async () => {
  const result = await evaluate(`(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    return { selected: document.querySelector('.color.selected').textContent, background: document.body.dataset.color };
  })()`);
  assert.deepEqual(result, { selected: 'Green', background: '' });
});

test('clicking a color selects it and applies the background', async () => {
  const result = await evaluate(`(() => {
    document.querySelector('.color.blue').click();
    return { selected: document.querySelector('.color.selected').textContent, background: document.body.dataset.color };
  })()`);
  assert.deepEqual(result, { selected: 'Blue', background: 'blue' });
});
