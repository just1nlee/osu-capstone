"""Run MediaPipe Gesture Recognizer on one local still image."""

import argparse
import json
from pathlib import Path
import time
from typing import Any

import cv2
import mediapipe as mp


DEFAULT_MODEL = Path(__file__).parents[1] / "models" / "gesture_recognizer.task"
RUNNING_MODE = mp.tasks.vision.RunningMode.LIVE_STREAM


def category_to_dict(category: Any) -> dict[str, Any]:
    """Keep only stable, derived category fields in the output."""
    return {
        "name": category.category_name,
        "display_name": category.display_name,
        "score": category.score,
        "index": category.index,
    }


def landmark_to_dict(landmark: Any) -> dict[str, float]:
    """Convert a MediaPipe landmark to plain JSON-compatible coordinates."""
    return {"x": landmark.x, "y": landmark.y, "z": landmark.z}


def recognize(image_path: Path, model_path: Path) -> dict[str, Any]:
    """Recognize gestures in one image and return derived results."""
    if RUNNING_MODE is not mp.tasks.vision.RunningMode.IMAGE:
        raise ValueError(
            "recognize() currently accepts still images only. "
            "Set RUNNING_MODE to IMAGE or add the matching video/live-stream input."
        )

    options = mp.tasks.vision.GestureRecognizerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
        running_mode=RUNNING_MODE,
        num_hands=2,
    )

    image = mp.Image.create_from_file(str(image_path))
    with mp.tasks.vision.GestureRecognizer.create_from_options(options) as recognizer:
        result = recognizer.recognize(image)

    return {
        "gestures": [
            [category_to_dict(category) for category in hand]
            for hand in result.gestures
        ],
        "handedness": [
            [category_to_dict(category) for category in hand]
            for hand in result.handedness
        ],
        "landmarks": [
            [landmark_to_dict(landmark) for landmark in hand]
            for hand in result.hand_landmarks
        ],
        "world_landmarks": [
            [landmark_to_dict(landmark) for landmark in hand]
            for hand in result.hand_world_landmarks
        ],
    }


def print_live_result(
    result: mp.tasks.vision.GestureRecognizerResult,
    output_image: mp.Image,
    timestamp_ms: int,
) -> None:
    """Print each live-stream result as derived JSON."""
    del output_image
    print(
        json.dumps(
            {
                "timestamp_ms": timestamp_ms,
                "gestures": [
                    [category_to_dict(category) for category in hand]
                    for hand in result.gestures
                ],
                "handedness": [
                    [category_to_dict(category) for category in hand]
                    for hand in result.handedness
                ],
            }
        ),
        flush=True,
    )


def run_live_stream(model_path: Path) -> None:
    """Read webcam frames until the user presses Q or closes the window."""
    options = mp.tasks.vision.GestureRecognizerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
        running_mode=RUNNING_MODE,
        num_hands=2,
        result_callback=print_live_result,
    )

    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        raise RuntimeError("Could not open camera 0.")

    try:
        with mp.tasks.vision.GestureRecognizer.create_from_options(options) as recognizer:
            while True:
                success, frame = camera.read()
                if not success:
                    raise RuntimeError("Could not read a frame from camera 0.")

                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(
                    image_format=mp.ImageFormat.SRGB,
                    data=rgb_frame,
                )
                recognizer.recognize_async(mp_image, time.monotonic_ns() // 1_000_000)

                cv2.imshow("MediaPipe Gesture Recognizer - press Q to quit", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
    finally:
        camera.release()
        cv2.destroyAllWindows()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Recognize gestures in one local image."
    )
    parser.add_argument(
        "image",
        type=Path,
        nargs="?",
        help="Path to a local image file; not used in LIVE_STREAM mode",
    )
    parser.add_argument(
        "--model",
        type=Path,
        default=DEFAULT_MODEL,
        help="Path to gesture_recognizer.task",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.model.is_file():
        raise SystemExit(
            f"Model not found: {args.model}. "
            "Follow test-model/README.md to download it."
        )
    if RUNNING_MODE is mp.tasks.vision.RunningMode.LIVE_STREAM:
        run_live_stream(args.model)
        return
    if not args.image:
        raise SystemExit("An image path is required when RUNNING_MODE is IMAGE.")
    if not args.image.is_file():
        raise SystemExit(f"Image not found: {args.image}")
    print(json.dumps(recognize(args.image, args.model), indent=2))


if __name__ == "__main__":
    main()
