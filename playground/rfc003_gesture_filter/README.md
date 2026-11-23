# RFC-003 filter comparison

Written 2026-11-22. Runs the three options from RFC-003 (A: every frame, B: N consecutive frames, C: state machine) against synthetic gesture sequences at 30 and 15 fps. No camera, no MediaPipe, no footage.

    python3 run.py                 # comparison table
    python3 -m unittest -q         # asserts C meets the RFC's acceptance criteria

Files: `filters.py` (A, B, C), `scenarios.py` (one sequence per RFC test plus RC-2 from Workshop 4), `run.py`, `test_filters.py`.

## Not covered
- Real MediaPipe output (labels and confidences here are scripted).
- Real end-to-end latency. The numbers are filter delay only. C's is `stable_ms` rounded up to the next frame.
- Confident misclassification: a steady wrong label passes every filter (shown as n/a).
- Thresholds (`stable_ms=150`, `release_ms=200`, `gap_ms=100`) are guesses, not tuned values.

## Live demo (webcam)

Runs Google's pretrained Gesture Recognizer on the webcam and passes each result through filter A, B or C. The preview shows the raw label and score, the filter in use, and the command that fired.

    python3 -m venv .venv
    .venv/bin/python -m pip install -r requirements.txt
    mkdir -p models && curl -L -o models/gesture_recognizer.task \
      "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task"
    .venv/bin/python live_demo.py            # keys: f = switch filter, r = reset, q = quit
    .venv/bin/python live_demo.py --selftest # no camera

Only labels, scores and timestamps are written (`log.csv`, git-ignored). Frames are never saved.

Gesture-to-command mapping (Open_Palm = open, Closed_Fist = close, Thumb_Up = next, Thumb_Down = previous) is taken from `interface/config.py` on Farzaan's branch.

## First live run (2026-11-22)
Open_Palm scored mean 0.53 (max 0.70) and Thumb_Up mean 0.69, so the 0.7 default rejected them while Closed_Fist (mean 0.79) fired. The demo threshold is now 0.5. A single global threshold fits poorly, so per-gesture thresholds are the next step.
