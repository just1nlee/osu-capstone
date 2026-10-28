# Gesture Control POC

## Overview

A small Electron app demonstrating real-time MediaPipe gesture recognition running locally to control a desktop interface. Webcam images stay on the device; the app does not save them.

## Architecture

```text
Electron Desktop App
        |
        v
      Webcam
        |
        v
MediaPipe Gesture Recognizer
  ├── Hand detection
  ├── Hand landmarks (21 × 3)
  └── Built-in gesture classification
             |
             v
       Gesture stabilization
       (consecutive frames)
             |
             v
       Cooldown + release
             |
             v
       Application actions
             |
             v
     UI selection / background
```

The Electron main process creates the window, serves local files through a secure app origin, and handles camera permission requests. The renderer contains the interface, camera, and recognition logic. Keyboard, mouse, and gestures use the same selection and activation functions.

## Setup

Install Node.js and npm, then run:

```sh
npm install
npm start
```

The matching MediaPipe runtime assets are installed with the npm package. When gesture control is first enabled, the official pretrained model downloads automatically from Google; this requires an internet connection. No separately managed server is needed.

Enable gesture control and allow the camera when prompted. On macOS, check **System Settings → Privacy & Security → Camera** if access is denied, and allow the Electron app; restart it after changing permission. When running from source, the Electron development app supplies its camera usage description. Other operating systems may require camera access to be enabled in their privacy settings too.

## Usage

- Click a color to select and apply it immediately.
- Press Up or Down to move the selection, and Enter or Space to apply it. Navigation wraps around.
- Enable **Gesture Control** to start the camera. Thumbs down selects the previous color, thumbs up selects the next, and a closed fist applies it. Disable the toggle to release the camera.
- Use the four sliders to change recognition FPS, minimum confidence, consecutive frames, and cooldown. Settings take effect immediately and reset when the app restarts.
- The MediaPipe diagnostics panel shows the complete latest result (including gestures, handedness, and landmarks), inference timing, and the last 100 recognition decisions and events. Freeze the output to inspect it, or clear the log. Diagnostics are kept in memory and are not saved; no camera images are recorded.

For the complete MediaPipe data flow and steps for adapting the gesture module to another Electron app, see [MEDIAPIPE_INTEGRATION.md](MEDIAPIPE_INTEGRATION.md).

## Implementation notes

Electron hosts the HTML, CSS, and JavaScript in a Chromium renderer. MediaPipe runs its inference locally using WebAssembly and the downloaded model; its pipeline detects a hand, estimates 21 three-dimensional landmarks, and classifies built-in gestures.

Consecutive matching predictions reduce accidental actions. After an action, a cooldown blocks gestures; after it expires, two neutral or no-hand frames are required before another gesture can trigger. Predictions during cooldown do not count toward release. Keyboard and mouse remain available throughout.

The FPS limiter uses `performance.now()` and processes only new video frames; the preview continues independently. Higher FPS can respond faster but uses more computation. Higher confidence filters uncertain predictions. More consecutive frames add stability and delay. Longer cooldowns leave more time between gesture actions.

## Known limitations

This is a learning POC, not production software. Accuracy depends on lighting, hand position, and camera quality. MediaPipe's built-in classifier has a limited gesture vocabulary. Initial model loading requires network access. Rapid gestures can be missed at low FPS, and consecutive-frame validation adds delay. The app is intended to run from source rather than as an installed executable.
