# MediaPipe integration guide

This guide explains how this proof of concept sends webcam frames to MediaPipe and connects the results to application actions. It also shows how to reuse the gesture module in another Electron renderer.

The module is a useful starting point, not a plug-in that can be dropped into any program unchanged. It assumes a browser-like renderer, a camera, a particular local URL for the MediaPipe package, and callbacks supplied by the host app. A program outside Electron would need to provide equivalent browser APIs and serve the module and runtime itself.

## The path from camera to action

```text
Enable gesture control
        ↓
getUserMedia({ video: true, audio: false })
        ↓
HTML <video> element displays the stream
        ↓
recognizeForVideo(video, timestamp) samples the current frame
        ↓
MediaPipe returns gestures, scores, handedness and landmarks
        ↓
The app checks the first gesture and its confidence
        ↓
Consecutive-frame validation → cooldown → release requirement
        ↓
onAction(gesture) → host application's existing action
```

Electron's main process creates the window, serves local files, and handles permission requests. The renderer owns the webcam stream, MediaPipe, the recognition state machine, and the UI. MediaPipe does not click buttons or control another application by itself.

## What MediaPipe receives and returns

In [`renderer/gestures.js`](renderer/gestures.js), `getUserMedia()` requests a video stream. The stream is assigned to `video.srcObject`, which allows the `<video>` element to show the preview. The inference loop passes that same video element to MediaPipe:

```js
const result = recognizer.recognizeForVideo(video, now);
```

Each call reads the current frame from the video element; it does not process a recording or the entire stream. `now` is a monotonic timestamp in milliseconds from `requestAnimationFrame`. Recognition is synchronous and runs in the renderer. The loop checks for a new video frame and the configured interval before making another call. At 5 FPS, it targets at most one inference every 200 ms; actual throughput may be lower. The preview can update between inference calls.

MediaPipe returns a result object with `gestures`, `landmarks`, `worldLandmarks`, and `handedness` arrays; this package version also exposes the deprecated `handednesses` field. Results are grouped by hand. The module requests one hand and reads the first gesture category for the first hand:

```js
const prediction = result.gestures[0]?.[0];
const category = prediction?.categoryName || '';
const score = prediction?.score || 0;
```

Landmarks indicate whether a hand is detected. MediaPipe estimates 21 hand landmarks internally; this app does not implement its own classifier. The result is also sent to the optional diagnostics callback. The existing interface displays the latest result as JSON, but it does not record video frames.

## How predictions become actions

`processGesture()` accepts only `Thumb_Up`, `Thumb_Down`, and `Closed_Fist` with a score at least equal to the configured confidence threshold. By default, the same accepted category must appear in two consecutive processed frames. A different category starts a new candidate; an unsupported or low-confidence result resets the candidate.

When enough frames agree, the module calls the host's `onAction(gesture)` callback and enters cooldown. Predictions continue during cooldown, but cannot trigger an action. Once cooldown expires, two consecutive processed frames without an accepted gesture are required before the module is ready again. A supported gesture below the confidence threshold counts as neutral for release. Frames seen during cooldown do not count toward release. These are **application-side rules**, not MediaPipe model settings.

The POC maps `Thumb_Up` to next selection, `Thumb_Down` to previous selection, and `Closed_Fist` to apply selection. The host can map the three accepted names to different existing actions. For this project's intended direction, those actions might navigate or rearrange a multiplexer; the gesture module itself does not implement a terminal-multiplexer connection.

## Reuse in another Electron application

### 1. Copy the module and install the dependency

Copy [`renderer/gestures.js`](renderer/gestures.js) into the target app's renderer source. Install the same package version used here from the target app's directory:

```sh
npm install @mediapipe/tasks-vision@0.10.35
```

The npm package supplies the JavaScript module and matching WebAssembly assets. The pretrained model is fetched automatically from the Google URL in `gestures.js` when the recognizer first initializes. Inference then executes locally. Initialization requires network access to that URL; a target app's content security policy and network configuration must permit the request.

### 2. Make the runtime available to the renderer

The copied file currently imports MediaPipe from:

```js
import { FilesetResolver, GestureRecognizer } from 'gesture://app/vision/vision_bundle.mjs';
```

It also loads WebAssembly from `gesture://app/vision/wasm`. Those URLs work here because [`electron/main.js`](electron/main.js) registers a secure `gesture://` scheme and maps `/vision/` to `node_modules/@mediapipe/tasks-vision`. **Copying `gestures.js` alone is not enough.**

For an app that already has a suitable local origin, serve the package's module and `wasm/` directory from that origin and change both URLs in `gestures.js` to match. Alternatively, adapt this POC's protocol registration and path-checked handler to the target app's directory layout and session. Register privileged schemes before Electron is ready and register the handler on the session used by the window. Do not disable `webSecurity`, renderer sandboxing, or context isolation just to load the module.

The renderer must support ES modules, `navigator.mediaDevices.getUserMedia`, `<video>`, and `requestAnimationFrame`. Its content security policy must permit the local module and WebAssembly runtime, plus the Google model URL. Keep the runtime assets matched to the installed package version.

### 3. Configure camera permission

Adapt the camera permission check and request handlers in [`electron/main.js`](electron/main.js) to allow camera access for the target app's trusted renderer origin. Do not grant unrelated permissions or microphone access for this POC. Operating-system permission still applies: on macOS, a source-run Electron app may need to be allowed in **System Settings → Privacy & Security → Camera**. A packaged macOS app needs an appropriate camera usage description in its `Info.plist`; packaging is outside this POC.

### 4. Provide a video element and connect callbacks

For example, add the following elements to the target renderer's HTML:

```html
<label><input id="gesture-toggle" type="checkbox"> Enable gesture control</label>
<video id="gesture-video" autoplay playsinline muted></video>
<p id="gesture-status"></p>
<p id="gesture-error" role="alert"></p>
<script type="module" src="app.js"></script>
```

Then connect the copied module in the target renderer. Replace the three example action functions with real functions provided by the target application:

```js
import {
  startGestureControl,
  stopGestureControl,
  updateGestureSettings
} from './gestures.js';

// Replace these with the target application's existing actions.
function selectPrevious() { /* host application action */ }
function selectNext() { /* host application action */ }
function activateSelection() { /* host application action */ }

const settings = { fps: 5, confidence: 0.70, frames: 2, cooldown: 1000 };
const toggle = document.querySelector('#gesture-toggle');
const video = document.querySelector('#gesture-video');
const status = document.querySelector('#gesture-status');
const error = document.querySelector('#gesture-error');

toggle.addEventListener('change', async () => {
  if (!toggle.checked) {
    stopGestureControl();
    return;
  }

  error.textContent = '';
  await startGestureControl({
    video,
    settings,
    onAction(gesture) {
      if (gesture === 'Thumb_Down') {
        selectPrevious();
        return 'Previous selection';
      }
      if (gesture === 'Thumb_Up') {
        selectNext();
        return 'Next selection';
      }
      if (gesture === 'Closed_Fist') {
        activateSelection();
        return 'Activated selection';
      }
    },
    onUpdate(update) {
      // Updates are partial: only replace a field when that key is present.
      if ('state' in update) status.textContent = update.state;
    },
    onError(message) {
      toggle.checked = false;
      error.textContent = message;
    },
    // Optional: inspect results and decisions without recording camera frames.
    onDiagnostic(kind, data) {
      // Connect to an in-memory debug panel if desired.
    }
  });
});

window.addEventListener('beforeunload', stopGestureControl);

// Example of changing a setting while running:
function setRecognitionFps(value) {
  settings.fps = Number(value);
  updateGestureSettings(settings, 'fps');
}
```

The callback functions used by keyboard and mouse should call the same host actions. The example functions above are placeholders: the target app must supply the real behavior. If that behavior requires a main-process or external operation, connect it through the target app's existing, appropriately secured interface; the renderer-only module does not provide one.

### 5. Understand the module's interface

| Export or callback | Purpose |
| --- | --- |
| `startGestureControl(options)` | Starts the camera and recognizer asynchronously. `video`, `settings`, `onAction`, `onUpdate`, and `onError` are required; `onDiagnostic` is optional. |
| `stopGestureControl()` | Stops the inference loop and camera tracks, clears the video source, and resets recognition state. Call it when disabling control or closing the view. |
| `updateGestureSettings(settings, changed)` | Applies a settings object. Pass the changed key (`fps`, `confidence`, `frames`, or `cooldown`) so candidate tracking resets when needed. Cooldown changes affect future activations. |
| `onAction(gesture)` | Called after stabilization with `Thumb_Up`, `Thumb_Down`, or `Closed_Fist`; return a readable action description for status updates. |
| `onUpdate(update)` | Receives partial UI updates such as `gesture`, `confidence`, `state`, `progress`, `cooldown`, `control-status`, and `last-action`. |
| `onError(message)` | Receives a user-facing camera, initialization, or inference error after the module stops capture. |
| `onDiagnostic(kind, data)` | Optional. Receives `result` (full result, frame timestamp and inference latency), `frame` (prediction and state-machine decision), or `event` (lifecycle, setting, or error message). |

The module uses shared module-level state and supports one active stream/recognizer in a renderer. It is designed for this single-window POC; independent simultaneous instances would require changes. It preserves the recognizer for reuse after stopping the camera.

## Verify the integration

1. Run the target application and confirm keyboard and mouse actions work before enabling gestures.
2. Enable gesture control, allow OS camera access, and verify the preview and recognition status.
3. Show each supported gesture; verify it calls the intended existing action only after the configured number of frames.
4. Hold a gesture through cooldown and confirm it does not repeatedly trigger. Release it for two processed frames, then try again.
5. Disable control and confirm the camera is released. Check the target's error UI for denied permission, missing camera, and unavailable model or runtime.
6. Test on the target platform and hardware. Lighting, camera quality, inference speed, and the built-in classifier affect behavior. Never include camera frames or recognizable people in debug logs or commits.

## References

- [MediaPipe Gesture Recognizer for web](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js)
- [Electron protocol API](https://www.electronjs.org/docs/latest/api/protocol)
- [Electron session permission API](https://www.electronjs.org/docs/latest/api/session)
