import { FilesetResolver, GestureRecognizer } from '/vision/vision_bundle.mjs';

// The protocol maps this URL to the Python test harness's model on disk.
const modelAssetPath = 'gesture://app/models/gesture_recognizer.task';
export async function createGestureRecognizer() {
  const vision = await FilesetResolver.forVisionTasks('gesture://app/vision/wasm');
  return GestureRecognizer.createFromOptions(vision, {
    baseOptions: { modelAssetPath },
    runningMode: 'VIDEO',
    numHands: 1,
  });
}

export function createGestureCapture(video, { onSample, onStatus, onDiagnostic, onTick, getFps }) {
  let generation = 0;
  let stream, recognizer, raf;
  let active = false;

  function stop(status = 'Camera off', phase = 'off') {
    generation++;
    active = false;
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    recognizer?.close();
    stream = recognizer = undefined;
    onStatus(status, phase);
  }

  async function start() {
    if (active) return;
    active = true;
    const attempt = ++generation;
    onStatus('Starting camera…', 'starting');
    let loadingModel = false;
    try {
      const modelStatus = await fetch(modelAssetPath, { method: 'HEAD', cache: 'no-store' });
      if (attempt !== generation) return;
      if (!modelStatus.ok) {
        stop(modelStatus.status === 404
          ? 'Missing model. Set up test-model/models/gesture_recognizer.task in the repository.'
          : 'Could not read the shared model in test-model/models.', 'error');
        return;
      }
      const incoming = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (attempt !== generation) {
        incoming.getTracks().forEach(track => track.stop());
        return;
      }
      stream = incoming;
      for (const track of stream.getVideoTracks()) {
        track.addEventListener('ended', () => {
          if (attempt === generation) stop('Camera disconnected.', 'error');
        });
      }
      video.srcObject = stream;
      await video.play();
      if (attempt !== generation) return;
      onStatus('Loading MediaPipe model…', 'loading');
      loadingModel = true;
      const model = await createGestureRecognizer();
      if (attempt !== generation) {
        model.close();
        return;
      }
      recognizer = model;
      onStatus('Camera on', 'on');
      let videoTime = -1;
      let lastInference = -Infinity;
      function tick(now) {
        if (attempt !== generation) return;
        if (video.readyState >= 2 && video.currentTime !== videoTime && now - lastInference >= 1000 / getFps()) {
          videoTime = video.currentTime;
          lastInference = now;
          try {
            const inferenceStart = performance.now();
            const result = model.recognizeForVideo(video, now);
            onDiagnostic('result', { result, timestampMs: now, latencyMs: performance.now() - inferenceStart });
            const prediction = result.gestures[0]?.[0];
            onSample({
              label: prediction?.categoryName, score: prediction?.score ?? 0,
              hand: result.landmarks.length > 0, timestampMs: now,
            });
          } catch {
            stop('Recognition failed. Check the camera and try again.', 'error');
            return;
          }
        }
        onTick(now);
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    } catch (error) {
      if (attempt !== generation) return;
      stop(loadingModel
        ? 'Could not load the shared MediaPipe model. Check the setup in the README.'
        : error.name === 'NotAllowedError' || error.name === 'SecurityError'
        ? 'Camera permission denied. Check macOS Privacy & Security settings.'
        : error.name === 'NotFoundError' ? 'No camera found.'
          : 'Could not start recognition. Check the camera and local model.', 'error');
    }
  }

  return { start, stop, isActive: () => active };
}
