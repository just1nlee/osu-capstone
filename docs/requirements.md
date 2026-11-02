# Product Requirements

## Product goal

Provide a local-first terminal multiplexer that lets users manage panes with
deliberate hand gestures while continuing to use the keyboard for terminal
work.

## Functional requirements

The product must:

- Recognize supported hand gestures from a camera feed.
- Reject low-confidence or unrecognized movements.
- Convert recognized gestures into semantic intents.
- Ensure a held gesture produces at most one command until release.
- Support intents for:
  - Creating or spawning a pane
  - Focusing or navigating between panes
  - Rearranging the layout
  - Launching an agent through the supported command interface
- Apply valid intents to the multiplexer layout.
- Reject malformed or unsupported intents without changing the layout.
- Provide visible feedback for the recognized gesture and resulting command.

## Quality and privacy requirements

The product must:

- Process camera input locally during normal use.
- Avoid saving or transmitting raw camera frames.
- Continue operating without a cloud runtime.
- Keep the recognizer and multiplexer independently testable.
- Document supported gestures, commands, setup, and known limitations.

## Acceptance criteria

The MVP is acceptable when:

- A user can start the application and use supported gestures to create a
  pane, change focus, and change the layout.
- Each supported gesture produces the intended action.
- A held gesture does not repeat the action unexpectedly.
- Low-confidence, unknown, and lost-tracking inputs produce no action.
- Invalid intents are rejected safely.
- Core behavior is covered by automated tests that do not require a camera.
- A clean setup can run the demo and tests using the documented instructions.