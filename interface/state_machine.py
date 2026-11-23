"""Convert live gesture predictions into one-shot application actions."""

from dataclasses import dataclass
from enum import Enum
from threading import RLock
from typing import Optional


class State(Enum):
    READY = "ready"
    CANDIDATE = "candidate"
    FIRED = "fired"


@dataclass(frozen=True)
class ActionDecision:
    """The state machine's decision for one prediction."""

    actionable: bool
    gesture: Optional[str]
    command: Optional[str]
    state: State
    reason: str


class GestureStateMachine:
    """Require a stable, confident gesture before emitting one mapped command."""

    def __init__(
        self,
        gesture_commands: dict[str, str],
        confidence_threshold: float = 0.70,
        stability_ms: int = 500,
        release_ms: int = 300,
    ) -> None:
        if not 0 <= confidence_threshold <= 1:
            raise ValueError("confidence_threshold must be between 0 and 1")
        if stability_ms < 0 or release_ms < 0:
            raise ValueError("stability_ms and release_ms must not be negative")

        self.gesture_commands = dict(gesture_commands)
        self.confidence_threshold = confidence_threshold
        self.stability_ms = stability_ms
        self.release_ms = release_ms
        self.state = State.READY
        self._candidate: Optional[str] = None
        self._candidate_started_ms: Optional[int] = None
        self._released_since_ms: Optional[int] = None
        self._lock = RLock()

    def process(
        self,
        gesture: Optional[str],
        confidence: float,
        timestamp_ms: int,
    ) -> ActionDecision:
        """Process one model prediction without handling camera frames."""
        if timestamp_ms < 0:
            raise ValueError("timestamp_ms must not be negative")

        accepted = (
            gesture in self.gesture_commands
            and confidence >= self.confidence_threshold
        )

        with self._lock:
            if self.state is State.FIRED:
                if accepted:
                    self._released_since_ms = None
                    return self._decision(
                        False, gesture, "waiting for gesture release"
                    )

                if self._released_since_ms is None:
                    self._released_since_ms = timestamp_ms
                if timestamp_ms - self._released_since_ms < self.release_ms:
                    return self._decision(
                        False, None, "release not held long enough"
                    )

                self._reset_candidate()
                self.state = State.READY

            if not accepted:
                self._reset_candidate()
                self.state = State.READY
                return self._decision(False, gesture, "unsupported or low confidence")

            if self.state is State.READY or gesture != self._candidate:
                self._candidate = gesture
                self._candidate_started_ms = timestamp_ms
                self.state = State.CANDIDATE

            assert self._candidate_started_ms is not None
            if timestamp_ms - self._candidate_started_ms < self.stability_ms:
                return self._decision(False, gesture, "gesture is not stable yet")

            self.state = State.FIRED
            self._released_since_ms = None
            return self._decision(True, gesture, "stable gesture mapped to command")

    def _reset_candidate(self) -> None:
        self._candidate = None
        self._candidate_started_ms = None
        self._released_since_ms = None

    def _decision(
        self,
        actionable: bool,
        gesture: Optional[str],
        reason: str,
    ) -> ActionDecision:
        return ActionDecision(
            actionable=actionable,
            gesture=gesture,
            command=self.gesture_commands.get(gesture) if actionable else None,
            state=self.state,
            reason=reason,
        )
