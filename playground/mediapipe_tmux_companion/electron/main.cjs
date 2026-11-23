const { app, BrowserWindow, ipcMain, Menu, nativeImage, powerMonitor, protocol, session, systemPreferences, Tray } = require('electron');
const path = require('node:path');
const { scheme, appUrl, createAssetHandler, allowsVideoCapture } = require('./protocol.cjs');
const { createTmuxClient, socketArgsFrom, resolveTmuxPath } = require('./tmux.cjs');
const { createSessionSelection } = require('./session-selection.cjs');
const { openSettings } = require('./settings.cjs');
const { createDispatcher, prepareMapping } = require('./dispatch.cjs');
const { gestureLabels, validateBinding, validateMappings } = require('../shared/config.js');
const { validateBindingOptions } = require('../shared/commands.js');

protocol.registerSchemesAsPrivileged([{
  scheme, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);
app.setName('MediaPipe tmux Companion');

const fail = (code, message) => ({ ok: false, code, message });
const failureResult = error => fail(error.code || 'unexpected', error.message || 'An unexpected error occurred.');

async function start() {
  const selection = createSessionSelection();
  const settings = await openSettings(app.getPath('userData'));
  let tmux;
  let refreshPending;
  let window, tray;
  let quitting = false;
  let sequence = 0;
  let camera = { enabled: false, captureGeneration: 0, phase: 'off' };
  let guardUnlocked = false;
  let serverKey;
  let catalogEpoch = 0;
  let catalog = new Map();
  let activeCatalogKey;
  let catalogPending;

  const isContent = contents => contents && window && contents === window.webContents
    && !contents.isDestroyed() && contents.getURL() === appUrl;
  const snapshot = () => ({
    ...settings.read(),
    sessions: selection.snapshot(), camera, guardUnlocked, sequence, catalogEpoch,
    windowVisible: Boolean(window?.isVisible() && !window.isMinimized()),
  });

  function openWindow() {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }

  function updateTray() {
    tray.setTitle(camera.enabled ? 'Gestures On' : 'Gestures');
    tray.setToolTip(camera.enabled ? 'MediaPipe camera enabled' : 'MediaPipe camera off');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Companion', click: openWindow },
      { label: camera.enabled ? 'Turn camera off' : 'Turn camera on', click: () => setCamera(!camera.enabled) },
      { label: 'Refresh sessions', click: () => void refreshSessions() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]));
  }

  function publish() {
    sequence++;
    const state = snapshot();
    if (isContent(window?.webContents)) window.webContents.send('companion:stateChanged', state);
    if (tray) updateTray();
    return state;
  }

  function setCamera(enabled) {
    if (typeof enabled !== 'boolean') return fail('invalid_input', 'Choose a camera state.');
    if (enabled !== camera.enabled || (!enabled && camera.phase !== 'off')) {
      dispatcher.cancelPending();
      camera = { enabled, captureGeneration: camera.captureGeneration + 1, phase: enabled ? 'starting' : 'off' };
      publish();
    }
    return { ok: true, camera };
  }

  function reportCamera({ captureGeneration, phase } = {}) {
    if (captureGeneration !== camera.captureGeneration || !camera.enabled
        || !['starting', 'loading', 'on', 'error'].includes(phase)) {
      return fail('stale_camera', 'Camera status changed.');
    }
    if (phase !== camera.phase) {
      if (phase === 'error') dispatcher.cancelPending();
      camera = { ...camera, enabled: phase !== 'error', phase };
      publish();
    }
    return { ok: true };
  }

  async function getTmux() {
    if (!tmux) {
      const socketArgs = socketArgsFrom(process.env);
      const binary = await resolveTmuxPath();
      tmux = createTmuxClient({ binary, socketArgs });
    }
    return tmux;
  }

  function refreshSessions() {
    if (refreshPending) return refreshPending;
    refreshPending = (async () => {
      const previous = selection.snapshot().targetToken;
      let result;
      try {
        result = await (await getTmux()).discover();
      } catch (error) {
        if (error.code === 'tmux_missing') tmux = undefined;
        result = { status: 'error', list: [], message: failureResult(error).message };
      }
      selection.applyDiscovery(result);
      const nextServer = result.list[0]?.serverKey;
      if (nextServer !== serverKey) {
        serverKey = nextServer;
        activeCatalogKey = undefined;
        catalogEpoch++;
      }
      if (previous !== selection.snapshot().targetToken) dispatcher.cancelPending();
      return { ok: true, ...publish() };
    })().finally(() => { refreshPending = undefined; });
    return refreshPending;
  }

  function readCatalog(force = false) {
    const observed = serverKey;
    if (observed && activeCatalogKey === observed && !force) return Promise.resolve(catalog);
    if (catalogPending?.key === observed && catalogPending) return catalogPending.promise;
    const entry = { key: observed };
    entry.promise = (async () => {
      const commands = await (await getTmux()).listCommands();
      if (observed !== serverKey) throw Object.assign(new Error('The tmux server changed. Refresh commands.'), { code: 'stale_target' });
      catalog = new Map(commands.map(command => [command.name, command]));
      activeCatalogKey = observed;
      return catalog;
    })().finally(() => { if (catalogPending === entry) catalogPending = undefined; });
    catalogPending = entry;
    return entry.promise;
  }

  const getCommands = target => {
    if (target.serverKey !== serverKey) return Promise.resolve(new Map());
    return readCatalog();
  };
  const dispatcher = createDispatcher({
    getState: snapshot, getSession: selection.target, getMappings: settings.read, getCommands,
    tmux: {
      readContext: async (...args) => (await getTmux()).readContext(...args),
      readTarget: async (...args) => (await getTmux()).readTarget(...args),
      runAction: async (...args) => (await getTmux()).runAction(...args),
    },
  });

  const handlers = {
    getState: () => ({ ok: true, ...snapshot() }),
    refreshSessions,
    selectSession(key) {
      const previous = selection.snapshot().targetToken;
      if (typeof key !== 'string' || !selection.select(key)) {
        return fail('stale_target', 'Refresh the session list and select an available session.');
      }
      if (previous !== selection.snapshot().targetToken) dispatcher.cancelPending();
      return { ok: true, ...publish() };
    },
    async listCommands() {
      try {
        const commands = await readCatalog(true);
        return { ok: true, commands: [...commands.values()] };
      } catch (error) {
        if (error.code === 'no_server') return fail('no_server', 'Start tmux and refresh sessions to load the command catalog.');
        return failureResult(error);
      }
    },
    async saveMappings(value) {
      const validation = validateMappings(value);
      if (!validation.ok) return validation;
      const saved = settings.read().mappings;
      for (const gesture of gestureLabels) {
        const binding = validation.mappings.gestures[gesture].binding;
        if (!binding || JSON.stringify(binding) === JSON.stringify(saved.gestures[gesture].binding)) continue;
        const metadata = catalog.get(binding.command);
        if (!metadata) return { ...fail('unknown_command', 'Choose a command from the tmux catalog.'), gesture };
        const options = validateBindingOptions(metadata, binding);
        if (!options.ok) return { ...options, gesture };
      }
      const result = await settings.save(validation.mappings);
      if (result.ok) {
        dispatcher.cancelPending();
        publish();
      }
      return result;
    },
    async checkMapping({ gesture, binding, targetToken } = {}) {
      if (!gestureLabels.includes(gesture)) return fail('invalid_gesture', 'Choose a supported gesture.');
      const valid = validateBinding(binding);
      if (!valid.ok) return valid;
      const target = selection.target();
      if (!target || targetToken !== selection.snapshot().targetToken) {
        return fail('stale_target', 'Select a tmux session before checking this mapping.');
      }
      const commands = await getCommands(target);
      const result = await prepareMapping({
        tmux: await getTmux(), session: target, metadata: commands.get(binding.command), binding: valid.binding,
      });
      if (targetToken !== selection.snapshot().targetToken) return fail('stale_target', 'The selected session changed.');
      return result.ok ? { ok: true, target: result.target, guarded: result.guarded } : result;
    },
    setGuardUnlocked(unlocked) {
      if (typeof unlocked !== 'boolean') return fail('invalid_input', 'Choose whether to unlock guarded commands.');
      if (guardUnlocked !== unlocked) {
        guardUnlocked = unlocked;
        dispatcher.cancelPending();
        publish();
      }
      return { ok: true, unlocked };
    },
    async dispatchGesture(request) {
      const result = await dispatcher.dispatch(request);
      if (result.code === 'stale_target') void refreshSessions();
      return result;
    },
    setCameraEnabled: setCamera,
    reportCameraStatus: reportCamera,
  };
  for (const [name, handle] of Object.entries(handlers)) {
    ipcMain.handle('companion:' + name, async (event, ...args) => {
      if (!isContent(event.sender) || event.senderFrame !== event.sender.mainFrame || event.senderFrame?.url !== appUrl) {
        return fail('untrusted_sender', 'This request did not come from the companion.');
      }
      try { return await handle(...args); } catch (error) { return failureResult(error); }
    });
  }

  protocol.handle(scheme, createAssetHandler());
  function allowCamera(contents, permission, details, types) {
    if (!camera.enabled || !isContent(contents) || !allowsVideoCapture(permission, details, types)) return false;
    const status = process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('camera') : null;
    return status !== 'denied' && status !== 'restricted';
  }
  session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) =>
    allowCamera(contents, permission, details, [details.mediaType]));
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) =>
    callback(allowCamera(contents, permission, details, details.mediaTypes)));

  window = new BrowserWindow({
    title: 'MediaPipe tmux Companion',
    width: 1080, height: 800, minWidth: 460, minHeight: 440, show: false,
    backgroundColor: '#e7edf4',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('did-start-navigation', ({ isMainFrame, isSameDocument }) => {
    if (isMainFrame && !isSameDocument) setCamera(false);
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('render-process-gone', () => {
    setCamera(false);
    if (!quitting) void window.loadURL(appUrl);
  });
  window.on('close', event => {
    if (quitting) return;
    event.preventDefault();
    window.hide();
  });
  for (const event of ['hide', 'show', 'minimize', 'restore']) window.on(event, publish);
  window.once('ready-to-show', () => window.show());
  tray = new Tray(nativeImage.createEmpty());
  updateTray();

  app.on('second-instance', openWindow);
  app.on('activate', openWindow);
  app.on('window-all-closed', () => {});
  const timer = setInterval(() => {
    if (selection.target()) void refreshSessions();
  }, 3000);
  for (const event of ['lock-screen', 'suspend', 'user-did-resign-active']) {
    powerMonitor.on(event, () => setCamera(false));
  }
  app.on('before-quit', () => {
    quitting = true;
    clearInterval(timer);
    setCamera(false);
  });

  await window.loadURL(appUrl);
  void refreshSessions();
}

if (app.requestSingleInstanceLock()) {
  app.whenReady().then(start).catch(error => {
    console.error(error);
    app.exit(1);
  });
} else {
  app.quit();
}
