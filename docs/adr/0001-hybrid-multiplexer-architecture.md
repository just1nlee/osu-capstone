# 1. Hybrid multiplexer architecture: C multiplexer, headless recognizer, optional Electron companion app

- Status: accepted
- Deciders: Farzaan Wadiwalla, Havel Konda, Justin Lee, Tobias Kohn
- Date: YYYY-MM-DD

## Context and Problem Statement

The multiplexer core starts in Sprint 2, and its language, the command protocol, gesture feedback, and the rendering tests all depend on what the multiplexer is. Which code owns terminal state is hard to reverse, because changing it later means rewriting the PTY handling, the rendering, and the tests built on both. The full analysis is in [RFC-001](../rfcs/2026-10-25-rfc-draft-justin.md).

## Considered Options

- A: an Electron GUI with an xterm.js instance per pane
- B: a native C multiplexer that runs inside any terminal emulator
- C: the native C multiplexer from B, plus an optional Electron companion app
- D: defer the decision until recognition accuracy is known

## Decision Outcome

Chosen option: **C**, by team majority vote. The multiplexer and its terminal core are written in C and run in the user's own terminal (FR-11). The gesture recognizer is a separate headless process that sends intents over a local socket. An optional Electron companion app adds a system-wide hotkey and a debug view (FR-14), and the multiplexer never depends on it (FR-10).

### Consequences

- Good: the multiplexer runs and is tested headless, with no front end attached (NFR-7).
- Good: the companion app can change or be dropped without touching the core.
- Bad: the team owns PTY handling, compositing, and redraw performance (risk R-5).
- Bad: two programs to build. If the companion app's checks still fail at the start of winter term, it is dropped and the project continues as option B.

### Rejected

- A, because the multiplexer would exist only inside our app and users could not keep their own terminal.
- B alone, because a program inside a terminal cannot register a system-wide hotkey.
- D, because the recognizer would be built against a guessed protocol and CI would have nothing to test.

### Left open

The recognizer's language, the VT parsing approach, and the build and test toolchain. See Deferred decisions in [`docs/design.md`](../design.md).
