const { app, BrowserWindow, net, protocol, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([{ scheme: 'gesture', privileges: {
  standard: true, secure: true, supportFetchAPI: true, stream: true
} }]);

app.whenReady().then(() => {
  const rendererRoot = path.join(__dirname, '../renderer');
  const visionRoot = path.join(__dirname, '../node_modules/@mediapipe/tasks-vision');
  protocol.handle('gesture', (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'app') return new Response('Not found', { status: 404 });
    const pathname = decodeURIComponent(url.pathname);
    const isVision = pathname.startsWith('/vision/');
    const root = isVision ? visionRoot : rendererRoot;
    const relativeUrl = isVision ? pathname.slice('/vision'.length) : pathname;
    const file = path.resolve(root, '.' + relativeUrl);
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });

  const allowed = (url, permission) => permission === 'media' && url.startsWith('gesture://app/');
  session.defaultSession.setPermissionCheckHandler((_contents, permission, origin) => allowed(origin + '/', permission));
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const cameraOnly = details.mediaTypes?.every(type => type === 'video');
    callback(allowed(contents.getURL(), permission) && cameraOnly);
  });

  const window = new BrowserWindow({
    width: 1100, height: 800, minWidth: 800, minHeight: 650,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  window.loadURL('gesture://app/index.html');
});

app.on('window-all-closed', () => app.quit());
