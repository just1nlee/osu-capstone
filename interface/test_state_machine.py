import unittest

from state_machine import GestureStateMachine, State


class GestureStateMachineTests(unittest.TestCase):
    def setUp(self):
        self.machine = GestureStateMachine(
            {"Open_Palm": "open"},
            confidence_threshold=0.7,
            stability_ms=500,
            release_ms=300,
        )

    def test_requires_stability_before_emitting(self):
        self.assertFalse(self.machine.process("Open_Palm", 0.9, 0).actionable)
        decision = self.machine.process("Open_Palm", 0.9, 500)
        self.assertTrue(decision.actionable)
        self.assertEqual(decision.command, "open")

    def test_held_gesture_emits_once(self):
        self.machine.process("Open_Palm", 0.9, 0)
        self.assertTrue(self.machine.process("Open_Palm", 0.9, 500).actionable)
        self.assertFalse(self.machine.process("Open_Palm", 0.9, 1000).actionable)
        self.assertEqual(self.machine.state, State.FIRED)

    def test_release_allows_gesture_to_fire_again(self):
        self.machine.process("Open_Palm", 0.9, 0)
        self.machine.process("Open_Palm", 0.9, 500)
        self.machine.process(None, 0.0, 600)
        self.machine.process(None, 0.0, 900)
        self.machine.process("Open_Palm", 0.9, 1000)
        self.assertTrue(self.machine.process("Open_Palm", 0.9, 1500).actionable)

    def test_low_confidence_does_not_fire(self):
        decision = self.machine.process("Open_Palm", 0.69, 500)
        self.assertFalse(decision.actionable)
        self.assertEqual(self.machine.state, State.READY)

    def test_unknown_gesture_does_not_fire(self):
        decision = self.machine.process("Thumb_Up", 0.99, 500)
        self.assertFalse(decision.actionable)
        self.assertEqual(self.machine.state, State.READY)


if __name__ == "__main__":
    unittest.main()
