# MediaPipe recognition

## Shared model and setup

The companion and Python baseline use the same file, `test-model/models/gesture_recognizer.task`, under the repository root. The downloaded `.task` is ignored by Git. From the root on macOS:

~~~sh
mkdir -p test-model/models
curl -fL 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task' \
  -o test-model/models/gesture_recognizer.task
shasum -a 256 test-model/models/gesture_recognizer.task
~~~

The expected SHA-256 for the documented float16 version 1 artifact is:

~~~text
97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482
~~~

[The Python baseline](../../../test-model/src/recognize.py) sets this path as its default model. The [companion protocol](../electron/protocol.cjs) reads that same file and exposes it at the fixed `gesture://app/models/gesture_recognizer.task` URL. The installed `@mediapipe/tasks-vision` 0.10.35 dependency supplies JavaScript and its matching WASM. The app and tmux settings can open before the model is available. Turning on the camera checks the shared file first and reports a missing model before requesting capture. A file replacement takes effect at the next recognition start.

## From video to a gesture

1. [The camera module](../renderer/gestures.js) requests video only and connects it to the local preview.
2. An animation-frame loop checks for a new video frame and caps inference at the configured FPS. It calls `recognizeForVideo` with the video element and a monotonic timestamp in milliseconds.
3. MediaPipe detects a palm, estimates 21 hand landmarks, tracks the hand between frames, and classifies the pose. Results include categories and scores, handedness, and image and world-coordinate landmarks.
4. The renderer reads the first category for the first hand. The assignable roster is `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Down`, `Thumb_Up`, `Victory`, and `ILoveYou`. `None`, no hand, and unsupported labels never become commands.
5. [The gesture gate](../renderer/gesture-gate.js) stabilizes eligible labels. The renderer passes the accepted label and current state tokens to main. Camera frames, confidence scores, and model results stay in renderer memory.

## SDK settings

| SDK setting | Effective value | Purpose |
| --- | --- | --- |
| `baseOptions.modelAssetPath` | The fixed shared model URL | Loads the repository's model. |
| `runningMode` | `VIDEO` | Processes a timestamped camera stream. The Python baseline uses `LIVE_STREAM`. |
| `numHands` | 1 | Uses one hand. The Python baseline requests two. |
| `minHandDetectionConfidence` | 0.5, SDK default | Confidence threshold for palm detection. |
| `minHandPresenceConfidence` | 0.5, SDK default | A lower score can restart palm detection. |
| `minTrackingConfidence` | 0.5, SDK default | Bounding-box overlap threshold used by the hand tracker. |
| Canned and custom classifier options | SDK defaults | Score threshold 0, maximum results -1, default locale, and no app-defined allowlist or denylist. |

The delegate is left at the SDK default. The app’s confidence slider applies after classification, independently of the SDK hand detection, presence, and tracking thresholds. [Google MediaPipe Web configuration](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer?tab=Web#configuration_options)

## UI tuning and gesture timing

| Slider | Default | Range and step | Effect |
| --- | ---: | --- | --- |
| Recognition FPS | 5 | 1–30, step 1 | Upper bound on inference sampling. Actual throughput can be lower. |
| Minimum confidence | 0.70 | 0.50–0.95, step 0.05 | Minimum score for a gesture to count. |
| Consecutive frames | 2 | 1–10, step 1 | Number of qualifying samples of the same pose needed to accept it. |
| Gesture cooldown | 1,000 ms | 0–3,000 ms, step 100 | Delay before the release check begins. |

Slider changes apply live and reset on restart. A changed eligible pose starts a new candidate. A nonqualifying frame clears the candidate. After firing and cooldown, the app requires two neutral samples, even at zero cooldown. A low-confidence, disabled, unmapped, unsupported, or absent pose counts as neutral. Changes to tuning, mappings, selection, camera eligibility, or guard reset the gate and require release.

A guarded command adds a continuous hold after stabilization. Main checks at least 1,000 ms between begin and commit. The renderer waits for at least 1,050 ms in its sample clock to allow for delivery time. If the pose changes, confidence drops, or the frame gap exceeds the greater of 250 ms and 2,500 divided by configured FPS, the held attempt cancels.

## Diagnostics and capture lifecycle

The panel has a preview, gesture label and confidence, gate state, progress, cooldown, last action, raw model result, frame timestamp, and inference time. **Freeze output** holds the displayed result while recognition continues. The log has up to 100 in-memory entries, and **Clear log** empties it. Hidden windows can continue recognition while they defer diagnostic DOM updates.

The camera starts off. The main window and menu bar can enable or disable it. Closing the window hides it. Camera off, quitting, screen lock, system suspend, user switching, or renderer reload or loss stop capture. Turn the camera on explicitly after returning. MediaPipe inference uses local runtime and model files.
