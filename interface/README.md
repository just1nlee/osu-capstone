# Gesture interface

This folder converts MediaPipe live-stream predictions into one-shot semantic
commands. The state machine is camera-independent and can be tested without a
camera or MediaPipe.

## Configuration

Edit [config.py](config.py) to change the default filtering and mappings:

```python
CONFIDENCE_THRESHOLD = 0.60
STABILITY_MS = 500
RELEASE_MS = 300
```

- `CONFIDENCE_THRESHOLD`: minimum model confidence.
- `STABILITY_MS`: how long a supported gesture must remain stable.
- `RELEASE_MS`: how long a gesture must be absent before it can fire again.

The current threshold is a shared baseline. Later, configure confidence
thresholds per gesture because model confidence varies by gesture and
destructive commands may require stricter filtering.

The command-line flags `--confidence`, `--stability-ms`, and `--release-ms`
temporarily override these defaults for an experiment without editing the
file. Gesture mappings are defined in the same configuration file.

Run the state-machine tests from the repository root:

```sh
python3 -m unittest discover -s interface -p 'test_*.py'
```

From the repository root, activate the model virtual environment first:

```sh
source test-model/.venv/bin/activate
```

On Windows, activate `test-model\.venv\Scripts\Activate.ps1` instead. Then
run the webcam pipeline after downloading the model described in
`test-model/README.md`:

```sh
python3 -m interface.main
```

The state machine receives every live prediction, but the runner prints only
when a supported gesture has passed the confidence and stability checks. A
held gesture therefore produces one JSON record instead of continuously
spamming the terminal. Output is written to standard output:

```json
{"timestamp_ms": 1200, "gesture": "Open_Palm", "confidence": 0.91, "actionable": true, "command": "open", "state": "fired", "reason": "stable gesture mapped to command"}
```
