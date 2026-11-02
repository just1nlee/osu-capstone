// MediaPipe runs in the renderer: its runtime is local, while the pretrained model is fetched once on initialization.
import { FilesetResolver, GestureRecognizer } from 'gesture://app/vision/vision_bundle.mjs';

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
const supported = new Set(['Thumb_Up', 'Thumb_Down', 'Closed_Fist']);
let recognizer, stream, video, settings, onAction, onUpdate, onError, onDiagnostic = () => {};
let state = 'READY', candidate = '', candidateFrames = 0, neutralFrames = 0;
let cooldownUntil = 0, lastInference = 0, lastVideoTime = -1, animation;
let generation = 0;

function resetState() {
  state = 'READY'; candidate = ''; candidateFrames = 0; neutralFrames = 0; cooldownUntil = 0;
}
function renderState(now) {
  const labels = { READY: 'Ready', CANDIDATE: 'Recognizing', COOLDOWN: 'Cooldown', WAIT_FOR_RELEASE: 'Waiting for Release' };
  onUpdate({ state: labels[state], progress: `${candidateFrames} / ${settings.frames} frames`, cooldown: `${(Math.max(0, cooldownUntil - now) / 1000).toFixed(1)} s` });
}
// Turn MediaPipe's prediction into a stable app action. These states are app logic, not model states.
function processGesture(category, score, now) {
  const gesture = supported.has(category) && score >= settings.confidence ? category : '';
  const previousState = state;
  let decision = '';
  let action = null;
  if (state === 'COOLDOWN' && now >= cooldownUntil) {
    state = 'WAIT_FOR_RELEASE';
    neutralFrames = 0;
  }
  if (state === 'COOLDOWN') {
    decision = 'Ignored during cooldown';
  } else if (state === 'WAIT_FOR_RELEASE') {
    // Ignore neutral frames seen during cooldown; require two new ones before accepting another action.
    neutralFrames = gesture ? 0 : neutralFrames + 1;
    decision = gesture ? 'Waiting for a neutral frame' : `Neutral frame ${neutralFrames} / 2`;
    if (neutralFrames >= 2) { resetState(); decision = 'Released; ready for another gesture'; }
  } else if (!gesture) {
    state = 'READY'; candidate = ''; candidateFrames = 0;
    decision = category && supported.has(category) ? 'Below confidence threshold' : 'No supported gesture';
  } else {
    if (gesture !== candidate) { candidate = gesture; candidateFrames = 0; }
    state = 'CANDIDATE';
    candidateFrames++;
    decision = `Candidate ${candidateFrames} / ${settings.frames}`;
    if (candidateFrames >= settings.frames) {
      // The caller maps this semantic gesture to its own UI action; MediaPipe never controls the UI directly.
      action = onAction(gesture);
      onUpdate({ 'last-action': action });
      candidate = ''; candidateFrames = 0;
      cooldownUntil = now + settings.cooldown;
      state = 'COOLDOWN';
      decision = 'Action triggered';
    }
  }
  onDiagnostic('frame', { timestampMs: now, category: category || null, confidence: score,
    previousState, state, candidate, candidateFrames, neutralFrames,
    cooldownRemainingMs: Math.max(0, cooldownUntil - now), decision, action });
}

// The preview runs continuously; this loop samples only new frames at the configured inference rate.
function loop(now) {
  if (!stream) return;
  if (state === 'COOLDOWN' && now >= cooldownUntil) {
    state = 'WAIT_FOR_RELEASE'; neutralFrames = 0;
    onDiagnostic('event', 'Cooldown ended; waiting for two neutral frames');
  }
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastInference >= 1000 / settings.fps) {
    lastVideoTime = video.currentTime;
    lastInference = now;
    try {
      const inferenceStarted = performance.now();
      // MediaPipe reads the video's current frame, not the whole stream. The timestamp is in milliseconds.
      // Inference is synchronous: the returned object contains the prediction for this frame.
      const result = recognizer.recognizeForVideo(video, now);
      onDiagnostic('result', { result, timestampMs: now, latencyMs: performance.now() - inferenceStarted });
      // Results are grouped by hand; this POC uses one hand and its first gesture category.
      // Landmarks indicate whether a hand was detected; the category and score drive app decisions.
      const hand = result.landmarks.length > 0;
      const prediction = result.gestures[0]?.[0];
      const category = prediction?.categoryName || '';
      const score = prediction?.score || 0;
      onUpdate({ gesture: !hand ? 'No hand detected' : category && category !== 'None' && score >= settings.confidence ? category : 'Unrecognized', confidence: prediction ? `${Math.round(score * 100)}%` : '—' });
      processGesture(category, score, now);
    } catch (error) {
      console.error('Gesture recognition failed:', error);
      onDiagnostic('event', `Inference error: ${error.stack || error}`);
      stopGestureControl();
      onError('Gesture recognition failed. Enable gesture control to try again.');
      return;
    }
  }
  renderState(now);
  animation = requestAnimationFrame(loop);
}

export async function startGestureControl(options) {
  const token = ++generation;
  video = options.video; settings = { ...options.settings }; onAction = options.onAction; onUpdate = options.onUpdate; onError = options.onError; onDiagnostic = options.onDiagnostic || (() => {});
  resetState(); lastInference = 0; lastVideoTime = -1;
  onDiagnostic('event', 'Starting camera and gesture recognition');
  onUpdate({ error: '', 'control-status': 'Starting…', 'preview-placeholder': 'Starting camera…', 'last-action': 'None yet' });
  let newStream;
  try {
    // The browser supplies the webcam stream; attaching it to <video> provides both preview and inference input.
    newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    if (token !== generation) { newStream.getTracks().forEach(track => track.stop()); return; }
    stream = newStream;
    onDiagnostic('event', 'Camera stream started');
    video.srcObject = stream;
    await video.play();
    if (token !== generation) return;
    onUpdate({ 'preview-placeholder': '', 'control-status': 'Initializing…' });
  } catch (error) {
    if (token !== generation) return;
    onDiagnostic('event', `Camera error: ${error.name}: ${error.message}`);
    stopGestureControl();
    options.onError(error.name === 'NotAllowedError' || error.name === 'SecurityError' ? 'Camera permission denied. Allow camera access in your system settings and try again.' : error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError' ? 'No webcam found. Connect a camera and try again.' : 'Could not start the camera. Check your camera and try again.');
    return;
  }
  try {
    if (!recognizer) {
      onDiagnostic('event', 'Loading MediaPipe runtime and model');
      // Load the matching WebAssembly runtime and the pretrained gesture model; inference then runs locally.
      const vision = await FilesetResolver.forVisionTasks('gesture://app/vision/wasm');
      const created = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL }, runningMode: 'VIDEO', numHands: 1
      });
      if (token !== generation) { created.close(); return; }
      recognizer = created;
    }
    if (token !== generation) return;
    onDiagnostic('event', 'MediaPipe ready; recognition enabled');
    onUpdate({ 'control-status': 'Enabled' });
    animation = requestAnimationFrame(loop);
  } catch (error) {
    if (token !== generation) return;
    console.error('MediaPipe initialization failed:', error);
    onDiagnostic('event', `MediaPipe initialization error: ${error.stack || error}`);
    stopGestureControl();
    options.onError('Could not initialize MediaPipe. Check your internet connection and try again.');
  }
}
export function stopGestureControl() {
  generation++;
  if (stream) onDiagnostic('event', 'Gesture control stopped; camera released');
  cancelAnimationFrame(animation);
  // Stopping every track releases the webcam, while the recognizer can be reused on the next enable.
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  if (video) video.srcObject = null;
  resetState();
  if (onUpdate && settings) {
    onUpdate({ 'control-status': 'Disabled', 'preview-placeholder': 'Camera is off', gesture: 'No hand detected', confidence: '—', state: 'Ready', progress: `0 / ${settings.frames} frames`, cooldown: '0.0 s' });
  }
}
export function updateGestureSettings(next, changed) {
  settings = { ...next };
  onDiagnostic('event', `Setting changed: ${changed} = ${settings[changed]}`);
  if ((changed === 'confidence' || changed === 'frames') && (state === 'READY' || state === 'CANDIDATE')) {
    state = 'READY'; candidate = ''; candidateFrames = 0;
  }
  if (onUpdate) renderState(performance.now());
}
