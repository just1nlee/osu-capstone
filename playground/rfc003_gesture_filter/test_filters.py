import unittest

from filters import NaiveFilter, ConsecutiveFilter, GestureStateMachine
from run import run_one
from scenarios import SCENARIOS


class StateMachineMeetsRfc003(unittest.TestCase):
    pass


def _make(name, fps):
    _, segs, expected, onset, note = SCENARIOS[name]

    def test(self):
        got, lat = run_one(GestureStateMachine, segs, fps, onset)
        self.assertEqual(got, expected)
        if lat is not None:
            self.assertLessEqual(lat, 300)  # NFR-1 budget is 300 ms end to end
    return test


for _name, (_, _s, _e, _o, _note) in SCENARIOS.items():
    if _note:  # documented limitation, not a requirement
        continue
    for _fps in (30, 15):
        setattr(StateMachineMeetsRfc003, f"test_{_name}_{_fps}fps", _make(_name, _fps))


class RfcClaimsAboutOtherOptions(unittest.TestCase):
    """The RFC argues A and B fail the held-gesture case. Check that it's true."""

    def test_naive_repeats_on_hold(self):
        got, _ = run_one(NaiveFilter, SCENARIOS["hold_2s"][1], 30, 0)
        self.assertGreater(len(got), 1)

    def test_consecutive_still_repeats_on_hold(self):
        got, _ = run_one(lambda: ConsecutiveFilter(n=5), SCENARIOS["hold_2s"][1], 30, 0)
        self.assertGreater(len(got), 1)

    def test_naive_fires_on_one_bad_frame(self):
        got, _ = run_one(NaiveFilter, SCENARIOS["one_bad_frame"][1], 30, None)
        self.assertEqual(len(got), 1)


if __name__ == "__main__":
    unittest.main()
