"""Synthetic gesture sequences, one per test in RFC-003's verification plan.

A segment is (label, conf, duration). Duration is milliseconds (int) or
("f", n) for exactly n frames, so the same scenario runs at any fps.
"""
from filters import Frame

OP, TU, CF = "Open_Palm", "Thumb_Up", "Closed_Fist"


def _n_frames(dur, fps):
    if isinstance(dur, tuple):
        return dur[1]
    return max(1, round(dur * fps / 1000))


def build(segments, fps):
    """Return (frames, onset_ms of each segment)."""
    step = 1000 / fps
    frames, onsets, i = [], [], 0
    for label, conf, dur in segments:
        onsets.append(round(i * step))
        for _ in range(_n_frames(dur, fps)):
            frames.append(Frame(round(i * step), label, conf))
            i += 1
    return frames, onsets


# name -> (RFC test, segments, expected commands, onset segment index, note)
SCENARIOS = {
    "hold_2s": ("1 repeated commands",
        [(OP, .9, 2000)], [OP], 0, ""),
    "one_bad_frame": ("2 recognition stability",
        [(None, 0, 500), (OP, .9, ("f", 1)), (None, 0, 500)], [], None, ""),
    "low_confidence_hold": ("2 recognition stability",
        [(OP, .4, 2000)], [], None, ""),
    "release_and_repeat": ("3 gesture release",
        [(OP, .9, 600), (None, 0, 500), (OP, .9, 600)], [OP, OP], 0, ""),
    "tracking_lost": ("4 camera disconnect",
        [(None, 0, 2000)], [], None, ""),
    "one_frame_dropout_in_hold": ("RC-2 (Workshop 4)",
        [(OP, .9, 500), (None, 0, ("f", 1)), (OP, .9, 500)], [OP], 0, ""),
    "quick_switch": ("2 recognition stability",
        [(TU, .9, 80), (OP, .9, 800)], [OP], 1, ""),
    "confident_misclassification": ("limitation",
        [(CF, .95, 1000)], [], None,
        "steady wrong label passes any stability filter (RFC Analysis)"),
}
