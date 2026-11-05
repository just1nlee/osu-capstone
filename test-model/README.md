# Gesture recognizer test

This folder contains a small standalone Python program using MediaPipe's
built-in Gesture Recognizer. It supports still images and live webcam input,
printing detected gestures, confidence scores, handedness, and landmarks as
JSON. It does not connect to the terminal multiplexer.

The Python entry point is in `src\`, and the downloaded model is kept in
`models\`.

The active MediaPipe mode is set by the module-level `RUNNING_MODE` value in
`src\recognize.py`. It defaults to `RunningMode.IMAGE`. `LIVE_STREAM` is also
implemented: it opens camera 0, prints each result as JSON, and shows a local
preview. Press `Q` in the preview window to stop it. `VIDEO` is not implemented
yet.

## Setup on Windows

Use Python 3.9 or newer. MediaPipe `0.10.35` does not run on Python 3.8.

From the repository root, create and activate a virtual environment:

```powershell
py -3 -m venv test-model\.venv
test-model\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r test-model\requirements.txt
```

Download the pretrained model into the `models\` folder:

```powershell
Invoke-WebRequest `
  -Uri "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task" `
  -OutFile "test-model\models\gesture_recognizer.task"
```

## Current Allowed Inputs

### Live_stream mode

Set the mode to `LIVE_STREAM` to process webcam frames in real time:

```python
RUNNING_MODE = mp.tasks.vision.RunningMode.LIVE_STREAM
```

```powershell
python test-model\src\recognize.py
```

The preview runs continuously in real time, so gesture results may be printed
several times per second. That is expected for `LIVE_STREAM` mode. The first
run may require Windows camera permission. Keep the preview window focused and
press `Q` to stop.

### Image mode

Set the mode to `IMAGE` to process one local image:

```python
RUNNING_MODE = mp.tasks.vision.RunningMode.IMAGE
```

```powershell
python test-model\src\recognize.py C:\path\to\hand.jpg
```

The first successful run should print a JSON object. A hand may produce a
gesture such as `Thumb_Up`, `Open_Palm`, or `Closed_Fist`; an image without a
detected hand produces empty result arrays.

### Video mode

`VIDEO` mode is not implemented yet.


Temporal filtering, command mapping, and multiplexer integration are not
implemented yet.
