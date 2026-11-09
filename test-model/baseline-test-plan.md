# Live-stream baseline test plan

## Goal

Measure the recognizer's baseline accuracy, confidence, and latency for the
four gestures used by the project:

| Gesture | Intended action |
|---|---|
| `Open_Palm` | Open panel |
| `Closed_Fist` | Close panel |
| `Thumb_Up` | Next pane |
| `Thumb_Down` | Previous pane |

This test measures recognition only. It does not test pane commands or
multiplexer behavior.

## Test setup

- Use the same computer, webcam, lighting, camera position, and model version
  for all trials.
- Use `LIVE_STREAM` mode.
- Use one tester at a time, with the camera at a comfortable fixed distance.
- Keep the terminal visible so the JSON results can be observed.
- Do not record raw camera frames. Record only the gesture label, score,
  timestamps, and derived measurements.

Start from the repository root:

```powershell
test-model\.venv\Scripts\Activate.ps1
python test-model\src\recognize.py
```

Set this value in `src\recognize.py` before starting:

```python
RUNNING_MODE = mp.tasks.vision.RunningMode.LIVE_STREAM
```

## Trial procedure

Run 20 attempts for each gesture, for 80 total attempts.

For each attempt:

1. Start with no hand in view for at least 2 seconds.
2. Hold the target gesture clearly in view for 3 seconds.
3. Record the first stable result for that attempt:
   - predicted gesture
   - confidence score
   - time the gesture was presented
   - time the matching result appeared in the terminal
4. Remove the hand from view for at least 2 seconds before the next attempt.
5. Mark the attempt **correct** only when the predicted label matches the
   target label.

Use the same order for every gesture, or randomize the order before testing.
Record the order so the procedure can be repeated.

## Metric calculations

### Accuracy

For each gesture:

```text
Accuracy (%) = Correct attempts / Attempts × 100
```

### Average confidence

Average the confidence score of the first recorded result for each attempt,
including incorrect predictions. Report it as a percentage if the table uses
percent values.

### Average latency

For each attempt:

```text
Latency (ms) = result timestamp - presentation timestamp
```

Average the 20 latency values for each gesture. Use the same clock for both
timestamps. If presentation time is recorded manually, label latency as an
estimate rather than mixing manual and program timestamps.

## Recording results

Use [`baseline-model-results.md`](./baseline-model-results.md). Fill in one row
after completing all 20 attempts for that gesture.

The Overall row should contain:

- **Attempts:** total attempts across all four gestures
- **Correct:** total correct predictions
- **Accuracy:** total correct divided by total attempts
- **Avg. Latency:** average of all 80 attempt latencies
- **Avg. Confidence:** average of all 80 recorded confidence scores

Also record the date, tester, computer, webcam, lighting condition, Python
version, MediaPipe version, and model file version below the table or in the
test issue.

## Pass/fail interpretation

This first run is a baseline, not a release gate. Compare later changes
against the same procedure and setup. Do not claim that a gesture is reliable
from one tester or one environment alone.
