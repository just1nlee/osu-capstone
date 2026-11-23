"""Configuration for the gesture-to-command interface."""

from pathlib import Path


ROOT = Path(__file__).parents[1]

# State-machine filtering defaults.
# Baseline threshold for all gestures. Tune per gesture after more testing.
CONFIDENCE_THRESHOLD = 0.60
STABILITY_MS = 500
RELEASE_MS = 300

# Gesture labels are MediaPipe category names; values are semantic commands.
GESTURE_COMMANDS = {
    "Open_Palm": "open",
    "Closed_Fist": "close",
    "Thumb_Up": "next",
    "Thumb_Down": "previous",
}

MODEL_PATH = ROOT / "test-model" / "models" / "gesture_recognizer.task"
