const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const assets = require('../electron/protocol.cjs');
const { once } = require('node:events');
const { execFileSync, spawn } = require('node:child_process');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } = require('node:fs');
const { join } = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');
const { app } = require('electron');

const withoutModel = process.argv.includes('--without-model');
const { createAssetHandler, modelUrl, sharedModelPath } = assets;
const unexpectedModelRequests = [];

function serveSyntheticRecognizer() {
  const serveAsset = createAssetHandler();
  return request => {
    const { pathname } = new URL(request.url);
    if (request.url === modelUrl && request.method === 'HEAD') return new Response(null);
    if (pathname === '/vision/vision_bundle.mjs') {
      return new Response(`
        export class FilesetResolver {
          static async forVisionTasks() { return {}; }
        }
        export class GestureRecognizer {
          static async createFromOptions() { return new GestureRecognizer(); }
          recognizeForVideo() { return { gestures: [], landmarks: [] }; }
          close() {}
        }
      `, { headers: { 'Content-Type': 'text/javascript' } });
    }
    if (pathname.startsWith('/models/') || pathname.startsWith('/vision/')) {
      unexpectedModelRequests.push(`${request.method} ${request.url}`);
      return new Response(null, { status: 404 });
    }
    return serveAsset(request);
  };
}

const profile = mkdtempSync('/tmp/companion-app-');
const socket = join(profile, 'sock');
const binary = process.env.TMUX_TEST_BINARY || 'tmux';
if (process.env.TMUX_TEST_BINARY) {
  const directory = join(profile, 'bin');
  mkdirSync(directory);
  symlinkSync(binary, join(directory, 'tmux'));
  process.env.PATH = directory + ':' + process.env.PATH;
}
const raw = (...args) => execFileSync(binary, ['-S', socket, ...args], { timeout: 3000, encoding: 'utf8' });
app.setPath('userData', profile);
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
delete process.env.TMUX_COMPANION_SOCKET_NAME;
process.env.TMUX_COMPANION_SOCKET_PATH = socket;
let terminal;
const watchdog = setTimeout(() => {
  console.error('Electron companion smoke test timed out.');
  finish(1);
}, 40000);

async function eventually(read, predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await read();
    if (predicate(value)) return value;
    await sleep(100);
  }
  throw new Error('The companion did not reach the expected state.');
}

async function run() {
  const created = once(app, 'browser-window-created');
  if (withoutModel) assets.createAssetHandler = serveSyntheticRecognizer;
  require('../electron/main.cjs');
  const [, window] = await created;
  const errors = [];
  const { webContents } = window;
  webContents.on('preload-error', (_event, _path, error) => errors.push(error.message));
  webContents.on('console-message', details => {
    if (details.level === 'error' && !details.message.includes('TensorFlow Lite XNNPACK')) errors.push(details.message);
  });
  await once(webContents, 'did-finish-load');
  const evaluate = source => webContents.executeJavaScript(source);
  const state = () => evaluate('window.gestureCompanion.getState()');
  const selectCommand = (gesture, command) => evaluate(
    '(() => { const row = document.querySelector("[data-gesture=' + gesture + '] select");' +
    'row.value = ' + JSON.stringify(command) + '; row.dispatchEvent(new Event("change")); })()',
  );
  const click = selector => evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()');
  const layout = () => raw('list-panes', '-s', '-t', '$0', '-F', '#{window_id} #{pane_id} #{pane_pid} #{pane_active}').trim();
  await eventually(state, value => value.sessions.status === 'empty');
  assert.equal(await evaluate('window.isSecureContext && typeof require === "undefined"'), true);
  if (!withoutModel) {
    const expectedModelHash = createHash('sha256').update(readFileSync(sharedModelPath)).digest('hex');
    const modelCheck = await evaluate(`
      (async () => {
        const url = ${JSON.stringify(modelUrl)};
        const head = await fetch(url, { method: 'HEAD' });
        const model = await fetch(url);
        const digest = await crypto.subtle.digest('SHA-256', await model.arrayBuffer());
        const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        return { status: head.status, hash };
      })()
    `);
    assert.deepEqual(modelCheck, { status: 200, hash: expectedModelHash });
  }
  raw('-f', '/dev/null', 'new-session', '-ds', 'work');
  await evaluate('window.gestureCompanion.refreshSessions()');
  assert.equal((await state()).sessions.list.length, 1);
  const target = (await state()).sessions.targetToken;
  assert.ok(target);
  raw('split-window', '-h', '-t', '$0:');
  raw('new-window', '-d', '-t', '$0:');
  raw('new-session', '-ds', 'other');
  await evaluate('window.gestureCompanion.refreshSessions()');
  assert.equal((await state()).sessions.list.length, 2);
  assert.equal((await state()).sessions.targetToken, target);
  await eventually(() => evaluate(
    'Array.from(document.querySelector("[data-gesture=Thumb_Up] select").options).some(option => option.value === "move-pane")'
  ), Boolean);
  assert.equal(await evaluate('document.querySelectorAll("[data-gesture]").length'), 7);
  await selectCommand('Thumb_Up', 'move-pane');
  await click('#save-mappings');
  assert.match(await evaluate('document.querySelector("[data-gesture=Thumb_Up] .row-message").textContent'), /destination/i);
  await evaluate([
    'const destination = document.querySelector("[data-gesture=Thumb_Up] .command-field select");',
    'destination.value = "next-window"; destination.dispatchEvent(new Event("input"));',
    'undefined;',
  ].join('\n'));
  const beforeCheck = layout();
  await click('[data-gesture=Thumb_Up] .row-status button');
  await eventually(() => evaluate('document.querySelector("[data-gesture=Thumb_Up] .row-message").textContent'),
    text => text.includes('Ready for') && text.includes('→'));
  assert.equal(layout(), beforeCheck);
  await selectCommand('Thumb_Up', 'select-pane');
  await click('#save-mappings');
  await eventually(state, value => value.revision === 1);
  assert.equal((await state()).mappings.gestures.Thumb_Up.binding.command, 'select-pane');
  terminal = attachTerminal();
  await eventually(() => raw('list-clients', '-t', '$0', '-F', '#{client_name}').trim(), Boolean);

  await evaluate([
    'window.testPose = false;',
    'void 0;',
  ].join('\n'));
  await evaluate([
    '(async () => {',
    '  const { GestureRecognizer } = await import("/vision/vision_bundle.mjs");',
    '  const recognize = GestureRecognizer.prototype.recognizeForVideo;',
    '  GestureRecognizer.prototype.recognizeForVideo = function (...args) {',
    '    const result = recognize.apply(this, args);',
    '    if (window.testPose) return { ...result, gestures: [[{ categoryName: "Thumb_Up", score: 0.99 }]], landmarks: [[]] };',
    '    return result;',
    '  };',
    '})()',
  ].join('\n'));
  await evaluate([
    'window.testFrames = 0;',
    'navigator.mediaDevices.getUserMedia = async () => {',
    '  const canvas = Object.assign(document.createElement("canvas"), { width: 320, height: 240 });',
    '  const paint = canvas.getContext("2d");',
    '  window.testStream = canvas.captureStream(15);',
    '  window.testPainter = setInterval(() => {',
    '    paint.fillStyle = window.testFrames++ % 2 === 0 ? "#27384b" : "#334155";',
    '    paint.fillRect(0, 0, 320, 240);',
    '  }, 65);',
    '  return window.testStream;',
    '};',
    'undefined;',
  ].join('\n'));
  await evaluate('document.querySelector("#camera-toggle").click()');
  await eventually(state, value => value.camera.phase === 'on');
  await eventually(() => evaluate('document.querySelector("#result-meta").textContent'), text => text.includes('Inference:'));
  await evaluate(
    'void (window.testHidden = new Promise(resolve => {' +
    '  const unsubscribe = window.gestureCompanion.onStateChanged(value => {' +
    '    if (!value.windowVisible) { unsubscribe(); resolve(true); }' +
    '  });' +
    '}))',
  );
  window.close();
  assert.equal(await evaluate("window.testHidden"), true);
  const before = await evaluate('document.querySelector("#result-meta").textContent');
  const activeWork = () => raw('display-message', '-p', '-t', '$0:', '#{pane_id}').trim();
  const original = activeWork();
  await sleep(700);
  await evaluate('window.testPose = true');
  await eventually(activeWork, id => id !== original);
  const focused = activeWork();
  // Hold past the cooldown and allow time for more frames on slower runners.
  await sleep(2000);
  assert.equal(activeWork(), focused, 'FR-5: a held pose must change focus once');
  await evaluate('window.testPose = false');
  await sleep(500);
  await evaluate('clearInterval(window.testPainter)');
  await sleep(250);
  assert.equal(await evaluate('document.querySelector("#result-meta").textContent'), before);
  window.show();
  await eventually(() => evaluate('document.querySelector("#result-meta").textContent'), text => text !== before);
  await click('[data-gesture=Thumb_Up] [type=checkbox]');
  await click('#save-mappings');
  await eventually(state, value => value.revision === 2);
  const stored = JSON.parse(readFileSync(join(profile, 'gesture-mappings.v1.json'), 'utf8'));
  assert.equal(stored.gestures.Thumb_Up.enabled, false);
  assert.equal(stored.gestures.Thumb_Up.binding.command, 'select-pane');
  const inactive = await evaluate(
    '(async () => { const api = window.gestureCompanion; const state = await api.getState();' +
    'return api.dispatchGesture({ gesture: "Thumb_Up", revision: state.revision, ' +
    'targetToken: state.sessions.targetToken, captureGeneration: state.camera.captureGeneration }); })()',
  );
  assert.equal(inactive.code, 'disabled_gesture');
  await click('#close-lock');
  await eventually(state, value => value.guardUnlocked === true);
  window.hide();
  await evaluate('window.gestureCompanion.setCameraEnabled(false)');
  await eventually(() => evaluate('window.testStream.getVideoTracks()[0].readyState'), value => value === 'ended');
  await evaluate('clearInterval(window.testPainter)');
  await evaluate('window.gestureCompanion.setCameraEnabled(true)');
  const oldCamera = (await eventually(state, value => value.camera.phase === 'on')).camera;
  const reloaded = once(webContents, 'did-finish-load');
  webContents.reload();
  await reloaded;
  const afterReload = (await state()).camera;
  assert.equal(afterReload.enabled, false, 'reload must require an explicit restart of the camera');
  assert.ok(afterReload.captureGeneration > oldCamera.captureGeneration);
  const denied = await evaluate(
    'navigator.mediaDevices.getUserMedia({ video: true }).then(() => false, error => error.name === "NotAllowedError")',
  );
  assert.equal(denied, true);
  if (!withoutModel) {
    window.show();
    await evaluate('window.gestureCompanion.setCameraEnabled(true)');
    await eventually(state, value => value.camera.phase === 'on');
    assert.equal(await evaluate('document.querySelector("#gesture-video").srcObject.getVideoTracks().length'), 1);
    await evaluate('void (window.fakeDeviceTrack = document.querySelector("#gesture-video").srcObject.getVideoTracks()[0])');
    await evaluate('window.gestureCompanion.setCameraEnabled(false)');
    await eventually(() => evaluate('window.fakeDeviceTrack.readyState'), value => value === 'ended');
  }
  assert.deepEqual(unexpectedModelRequests, []);
  assert.deepEqual(errors, []);
  raw('kill-session', '-t', '$0');
  await eventually(state, value => value.sessions.status === 'lost');
  assert.equal((await state()).sessions.targetToken, null);
  const remaining = raw('list-panes', '-t', '$1:', '-F', '#{pane_pid}').trim();
  const quit = new Promise(resolve => app.once('will-quit', event => { event.preventDefault(); resolve(); }));
  app.quit();
  await quit;
  assert.equal(raw('list-panes', '-t', '$1:', '-F', '#{pane_pid}').trim(), remaining);
  assert.match(raw('list-keys', '-T', 'prefix', 'c'), /new-window/);
  console.log(`Electron companion (${withoutModel ? 'synthetic recognizer' : 'shared model'}) passed late discovery, stable session selection, guided move checks, mapping persistence, one-shot dispatch with the window hidden and a tmux terminal client attached, camera release, and tmux survival on quit.`);
}

function attachTerminal() {
  const child = spawn('python3', ['-c', [
    'import os, pty, select, sys',
    'os.environ["TERM"] = "xterm-256color"',
    'pid, fd = pty.fork()',
    'if pid == 0: os.execvp(sys.argv[1], sys.argv[1:])',
    'try:',
    '  while True:',
    '    if select.select([fd], [], [], 0.25)[0] and not os.read(fd, 8192): break',
    'except OSError:',
    '  pass',
    'os.waitpid(pid, 0)',
  ].join('\n'), binary, '-S', socket, 'attach-session', '-t', '$0'], { stdio: 'ignore' });
  child.on('error', error => console.error(error.message));
  return child;
}

run().then(() => finish(0), error => { console.error(error); finish(1); });

function finish(code) {
  clearTimeout(watchdog);
  try { raw('-N', 'kill-server'); } catch { /* The fixture may not have started a server. */ }
  terminal?.kill();
  rmSync(profile, { recursive: true, force: true });
  app.exit(code);
}
