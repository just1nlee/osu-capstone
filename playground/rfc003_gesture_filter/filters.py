"""The three filtering approaches from RFC-003, as pure functions of frames.

Each filter has update(frame) -> label | None. A returned label means
"emit one command now". No camera, no MediaPipe: only label, confidence
and timestamp, which is all the real filter would see.
"""
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Frame:
    t_ms: int
    label: Optional[str]  # None = no hand / tracking lost
    conf: float = 1.0


class NaiveFilter:
    """Option A: fire on every frame above the confidence threshold."""

    def __init__(self, threshold=0.7):
        self.threshold = threshold

    def update(self, f: Frame):
        if f.label is not None and f.conf >= self.threshold:
            return f.label
        return None


class ConsecutiveFilter:
    """Option B: accept once the same label has appeared in N frames in a row."""

    def __init__(self, n=5, threshold=0.7):
        self.n, self.threshold = n, threshold
        self.cur, self.count = None, 0

    def update(self, f: Frame):
        good = f.label is not None and f.conf >= self.threshold
        if good and f.label == self.cur:
            self.count += 1
        elif good:
            self.cur, self.count = f.label, 1
        else:
            self.cur, self.count = None, 0
        return self.cur if self.count >= self.n else None


class GestureStateMachine:
    """Option C: Idle -> Candidate -> Fired -> Idle.

    stable_ms   pose must stay stable this long (ms, so frame-rate independent)
    gap_ms      Candidate tolerates a bad frame for this long before resetting
    release_ms  pose must be absent this long before Fired -> Idle
                (the RC-2 fix from Workshop 4: one dropped frame must not re-arm)
    cooldown_ms optional dead time after release
    """
    IDLE, CANDIDATE, FIRED = "idle", "candidate", "fired"

    def __init__(self, threshold=0.7, stable_ms=150, gap_ms=100,
                 release_ms=200, cooldown_ms=0):
        self.threshold, self.stable_ms = threshold, stable_ms
        self.gap_ms, self.release_ms, self.cooldown_ms = gap_ms, release_ms, cooldown_ms
        self.state = self.IDLE
        self.cand = None
        self.since = 0
        self.last_good = 0
        self.fired_label = None
        self.absent_since = None
        self.cooldown_until = 0

    def update(self, f: Frame):
        good = f.label is not None and f.conf >= self.threshold

        if self.state == self.FIRED:
            if good and f.label == self.fired_label:
                self.absent_since = None
                return None
            if self.absent_since is None:
                self.absent_since = f.t_ms
            if f.t_ms - self.absent_since >= self.release_ms:
                self.state = self.IDLE
                self.cooldown_until = f.t_ms + self.cooldown_ms
            else:
                return None

        if self.state == self.IDLE:
            if good and f.t_ms >= self.cooldown_until:
                self.state, self.cand = self.CANDIDATE, f.label
                self.since = self.last_good = f.t_ms
            return None

        # CANDIDATE
        if good and f.label == self.cand:
            self.last_good = f.t_ms
            if f.t_ms - self.since >= self.stable_ms:
                self.state, self.fired_label, self.absent_since = self.FIRED, self.cand, None
                return self.cand
        elif good:  # a different pose: restart the timer on it
            self.cand, self.since, self.last_good = f.label, f.t_ms, f.t_ms
        elif f.t_ms - self.last_good >= self.gap_ms:
            self.state = self.IDLE
        return None
