const { readFile, stat } = require('node:fs/promises');
const path = require('node:path');

const scheme = 'gesture';
const appUrl = 'gesture://app/index.html';
const root = path.join(__dirname, '..');
const modelRoute = '/models/gesture_recognizer.task';
const modelUrl = 'gesture://app' + modelRoute;
const sharedModelPath = path.resolve(root, '../../test-model/models/gesture_recognizer.task');
const vision = 'node_modules/@mediapipe/tasks-vision';
const js = 'text/javascript; charset=utf-8';
const css = 'text/css; charset=utf-8';
const contentSecurityPolicy = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "style-src-elem 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const assets = new Map([
  ['/index.html', ['renderer/index.html', 'text/html; charset=utf-8']],
  ['/main.js', ['renderer/main.js', js]],
  ['/settings.js', ['renderer/settings.js', js]],
  ['/gesture-gate.js', ['renderer/gesture-gate.js', js]],
  ['/gestures.js', ['renderer/gestures.js', js]],
  ['/debug.js', ['renderer/debug.js', js]],
  ['/style.css', ['renderer/style.css', css]],
  ['/shared/config.js', ['shared/config.js', js]],
  ['/shared/commands.js', ['shared/commands.js', js]],
  ['/vision/vision_bundle.mjs', [`${vision}/vision_bundle.mjs`, js]],
]);

for (const variant of ['internal', 'module_internal', 'nosimd_internal']) {
  for (const [ext, type] of [['js', js], ['wasm', 'application/wasm']]) {
    const file = `wasm/vision_wasm_${variant}.${ext}`;
    assets.set(`/vision/${file}`, [`${vision}/${file}`, type]);
  }
}

function createAssetHandler(modelPath = sharedModelPath) {
  return async function serveAsset(request) {
    const url = new URL(request.url);
    if (url.protocol !== scheme + ':' || url.host !== 'app' || url.username || url.password) {
      return new Response(null, { status: 404 });
    }
    const isModel = url.pathname === modelRoute;
    const asset = assets.get(url.pathname);
    if (!isModel && !asset) return new Response(null, { status: 404 });

    const head = request.method === 'HEAD';
    if (request.method !== 'GET' && !(isModel && head)) {
      return new Response(null, { status: 405, headers: { Allow: isModel ? 'GET, HEAD' : 'GET' } });
    }

    try {
      let bytes, type;
      if (isModel) {
        if (!(await stat(modelPath)).isFile()) return new Response(null, { status: 404 });
        bytes = head ? null : await readFile(modelPath);
        type = 'application/octet-stream';
      } else {
        bytes = await readFile(path.join(root, asset[0]));
        type = asset[1];
      }
      return new Response(bytes, {
        headers: {
          'Content-Type': type,
          'Content-Security-Policy': contentSecurityPolicy,
          'X-Content-Type-Options': 'nosniff',
          ...(isModel && { 'Cache-Control': 'no-store' }),
        },
      });
    } catch (error) {
      return new Response(null, { status: error.code === 'ENOENT' ? 404 : 500 });
    }
  };
}

function allowsVideoCapture(permission, details, types) {
  return permission === 'media'
    && details.isMainFrame === true
    && details.requestingUrl === appUrl
    && types?.length === 1
    && types[0] === 'video';
}

module.exports = { scheme, appUrl, modelUrl, sharedModelPath, createAssetHandler, allowsVideoCapture };
