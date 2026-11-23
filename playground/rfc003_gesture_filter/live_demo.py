"""Live webcam demo: MediaPipe Gesture Recognizer -> RFC-003 filter -> command.

    .venv/bin/python live_demo.py            # webcam preview
    .venv/bin/python live_demo.py --selftest # no camera, checks the pipeline runs

Keys in the preview window:
    f  cycle filter: A (every frame) -> B (5 frames) -> C (state machine)
    r  reset the command counter
    q  quit

Only labels, scores and timestamps are logged (log.csv). Frames are never
written to disk.
"""
import argparse
import csv
import time
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

from filters import ConsecutiveFilter, Frame, GestureStateMachine, NaiveFilter

MODEL = Path(__file__).parent / "models" / "gesture_recognizer.task"
COMMANDS = {"Open_Palm": "open", "Closed_Fist": "close",
            "Thumb_Up": "next", "Thumb_Down": "previous"}
# Measured on a first live run: Open_Palm scored mean 0.53 (max 0.70) and
# Thumb_Up mean 0.69, so the 0.7 default rejected them. 0.5 lets them through.
THRESHOLD = 0.5
FILTERS = [
    ("A: every frame", lambda: NaiveFilter(threshold=THRESHOLD)),
    ("B: 5 consecutive frames", lambda: ConsecutiveFilter(n=5, threshold=THRESHOLD)),
    ("C: state machine", lambda: GestureStateMachine(threshold=THRESHOLD)),
]


def make_recognizer():
    vision = mp.tasks.vision
    options = vision.GestureRecognizerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL)),
        running_mode=vision.RunningMode.VIDEO,
        num_hands=1,
    )
    return vision.GestureRecognizer.create_from_options(options)


def top_gesture(result):
    """Return (label, score) for the best supported gesture, else (None, 0)."""
    if not result.gestures:
        return None, 0.0
    best = result.gestures[0][0]
    if best.category_name not in COMMANDS:
        return None, float(best.score)  # e.g. 'None', 'Victory': treated as no gesture
    return best.category_name, float(best.score)


def draw(img, lines, color=(255, 255, 255)):
    y = 28
    for text, c in lines:
        cv2.putText(img, text, (12, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 4)
        cv2.putText(img, text, (12, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, c or color, 2)
        y += 30


def selftest():
    """Run the real model on blank frames: no hand, so nothing should fire."""
    with make_recognizer() as rec:
        flt = GestureStateMachine()
        fired = 0
        for i in range(30):
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            result = rec.recognize_for_video(
                mp.Image(image_format=mp.ImageFormat.SRGB, data=frame), i * 33)
            label, score = top_gesture(result)
            fired += bool(flt.update(Frame(i * 33, label, score)))
    print(f"selftest ok: model loaded, 30 blank frames processed, {fired} commands fired")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--camera", type=int, default=0)
    args = ap.parse_args()
    if args.selftest:
        return selftest()

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        raise SystemExit("Could not open the camera. On macOS, allow camera access for "
                         "your terminal in System Settings > Privacy & Security > Camera.")

    fi = len(FILTERS) - 1  # start on C
    flt = FILTERS[fi][1]()
    counts, last_cmd, last_cmd_t = 0, "-", 0.0
    start = time.monotonic()
    last_ts = -1
    log_path = Path(__file__).parent / "log.csv"
    with make_recognizer() as rec, open(log_path, "w", newline="") as fh:
        log = csv.writer(fh)
        log.writerow(["t_ms", "label", "score", "filter", "command_fired"])
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            bgr = cv2.flip(bgr, 1)
            ts = max(int((time.monotonic() - start) * 1000), last_ts + 1)
            last_ts = ts
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            result = rec.recognize_for_video(
                mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), ts)
            label, score = top_gesture(result)

            out = flt.update(Frame(ts, label, score))
            if out:
                counts += 1
                last_cmd, last_cmd_t = COMMANDS[out], time.monotonic()
                print(f"[{ts:>7} ms] {FILTERS[fi][0][0]} -> {COMMANDS[out]}", flush=True)
            log.writerow([ts, label or "", f"{score:.3f}", FILTERS[fi][0][0], COMMANDS.get(out, "")])

            flash = time.monotonic() - last_cmd_t < 0.6
            draw(bgr, [
                (f"filter  {FILTERS[fi][0]}", None),
                (f"model   {label or '-'}  {score:.2f}", None),
                (f"command {last_cmd}   (total {counts})", (0, 255, 0) if flash else None),
                ("f = switch filter   r = reset   q = quit", (200, 200, 200)),
            ])
            cv2.imshow("RFC-003 gesture filter demo", bgr)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord("f"):
                fi = (fi + 1) % len(FILTERS)
                flt, counts, last_cmd = FILTERS[fi][1](), 0, "-"
            if key == ord("r"):
                counts, last_cmd = 0, "-"
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
