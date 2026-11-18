# 2. Which process owns the recognition on/off toggle

- Status: proposed
- Deciders: Farzaan Wadiwalla, Havel Konda, Justin Lee, Tobias Kohn
- Date: 2026-11-15

## Context and Problem Statement

FR-13 says the user turns gesture recognition on and off with one key binding, without restarting the multiplexer, and that the camera is released while recognition is off. Key bindings live in the multiplexer, but the camera is held by the recognizer, and the intent protocol in [`docs/design.md`](../design.md) only carries requests from the recognizer to the multiplexer. Today nothing lets the multiplexer tell the recognizer to stop. This came up as comment RC-3 in the Workshop 4 design review.

Whichever option is chosen, the intent protocol either changes or explicitly does not, so this needs review from both container owners (risk R-4).

## Decision Drivers

- FR-13: one key binding, and the operating system's camera-in-use indicator turns off.
- FR-10: the multiplexer must keep working with no recognizer running.
- R-4: every protocol change is expensive, because three components build against it.
- FR-14: the companion app will also want to start and stop recognition in winter.

## Considered Options

- **A. The multiplexer sends a control message.** The protocol becomes two-way on the existing connection: the multiplexer sends `{"v": 1, "ctl": "recognition_off"}` or `"recognition_on"`, and the recognizer releases or reopens the camera and replies. The key binding stays in the multiplexer with every other binding.
- **B. The recognizer owns the toggle.** The recognizer keeps its own on/off state and is switched by something outside the multiplexer, such as a system-wide hotkey (only possible from the companion app) or a signal. The intent protocol does not change.

## Pros and Cons of the Options

### A. The multiplexer sends a control message

- Good: one key binding in one place, inside the program the user is already typing into.
- Good: the companion app could use the same message later.
- Bad: changes the protocol, the schema file, and its snapshot test, so both owners must approve.
- Bad: the recognizer must read from the socket as well as write to it.
- Bad: with the multiplexer not running, the toggle does nothing, though in that case the recognizer is already dropping every command.

### B. The recognizer owns the toggle

- Good: no protocol change.
- Bad: a program running inside a terminal cannot register a system-wide hotkey, so before the winter companion app there is no single key binding for it, and FR-13 is not met in fall.
- Bad: the user has two places to look for controls.

## Decision Outcome

Not decided. The team chooses by vote before the RFC final, and this record is updated with the outcome and its consequences.
