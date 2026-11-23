"""Run the webcam recognizer and print state-machine decisions as JSON."""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT))

from interface.config import (  # noqa: E402
    CONFIDENCE_THRESHOLD,
    GESTURE_COMMANDS,
    MODEL_PATH,
    RELEASE_MS,
    STABILITY_MS,
)
from interface.state_machine import GestureStateMachine

def build_callback(state_machine: GestureStateMachine):
    """Create a MediaPipe callback that emits derived decisions only."""
    def callback(result, output_image, timestamp_ms: int) -> None:
        del output_image
        prediction = result.gestures[0][0] if result.gestures and result.gestures[0] else None
        decision = state_machine.process(
            prediction.category_name if prediction else None,
            prediction.score if prediction else 0.0,
            timestamp_ms,
        )
        if not decision.actionable:
            return

        print(
            json.dumps(
                {
                    "timestamp_ms": timestamp_ms,
                    "gesture": decision.gesture,
                    "confidence": prediction.score if prediction else 0.0,
                    "actionable": decision.actionable,
                    "command": decision.command,
                    "state": decision.state.value,
                    "reason": decision.reason,
                }
            ),
            flush=True,
        )

    return callback


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run gesture decisions from the webcam.")
    parser.add_argument(
        "--model",
        type=Path,
        default=MODEL_PATH,
    )
    parser.add_argument("--confidence", type=float, default=CONFIDENCE_THRESHOLD)
    parser.add_argument("--stability-ms", type=int, default=STABILITY_MS)
    parser.add_argument("--release-ms", type=int, default=RELEASE_MS)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model_source = ROOT / "test-model" / "src"
    sys.path.insert(0, str(model_source))
    from recognize import run_live_stream

    if not args.model.is_file():
        raise SystemExit(f"Model not found: {args.model}")

    state_machine = GestureStateMachine(
        GESTURE_COMMANDS,
        confidence_threshold=args.confidence,
        stability_ms=args.stability_ms,
        release_ms=args.release_ms,
    )
    run_live_stream(args.model, result_callback=build_callback(state_machine))


if __name__ == "__main__":
    main()
