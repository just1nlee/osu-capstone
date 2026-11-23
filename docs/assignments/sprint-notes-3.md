# Sprint Note: Sprint 3, Project 60: Vision-Based Gesture Control for Terminal Multiplexers

<!-- One page maximum. Each numbered section is graded pass/fail (20 points each).
     The evidence may be AI-generated from your repo history and board.
     Two things must be human-written: section 5, and the "shipped" sentence
     in each contribution line. Those are the parts anyone reads. -->

**Team:** Project 60: Vision-Based Gesture Control for Terminal Multiplexers
**Sprint dates:** 11/9/2026 to 11/22/2026
**Date submitted:** 11/22/2026

## 1. Working Software Evidence

- **Command Bus Demo:** https://youtu.be/S0fkG4OMToI
- **Companion App Test - Connecting Gesture Recognition Model to Existing Multiplexer (tmux) Demo:** https://youtu.be/dvACavmwkmQ
- **11/20/26 Havel Konda Missed Check-In Demo:** https://youtu.be/mNOr1UHojeE

## 2. What Got Done, and Who

- **Where the work is tracked:** https://github.com/just1nlee/osu-capstone/issues?q=is%3Aissue
- **Done this sprint:**
  - Created a minimal command bus prototype that supports three basic commands: focus, split_pane, and close_pane ([PR #37](https://github.com/just1nlee/osu-capstone/pull/37/changes/49811a9b4bd951bb34340f6f71921e67f29f0e96)), resolving GitHub Issue: feat/command-bus-prototype ([Issue #36](https://github.com/just1nlee/osu-capstone/issues/36))
  - Created a tmux gesture companion prototype that connects the MediaPipe gesture recognition model to an existing multiplexer (tmux), mapping held gestures to pane commands such as pane focus, and moved CI to run its unit, real-tmux integration, and Electron smoke tests on macOS without a webcam or model file ([PR #38](https://github.com/just1nlee/osu-capstone/pull/38))

### Done

**Justin Lee**

- owned: Implemented a minimal command bus prototype ([PR #37](https://github.com/just1nlee/osu-capstone/pull/37/changes/49811a9b4bd951bb34340f6f71921e67f29f0e96))
- reviewed: Did not review anything.
- shipped: I shipped a working command bus program that defines a command schema, parses input, and exposes an UNIX Domain Socket (UDS) endpoint, which will later be connected to the multiplexer. I know it works because I used a netcat client to connect to the endpoint and tested out registered commands. Commands that were listed in the schema are printed to stdout in the command bus process, while invalid commands receive an "ok":false and "error":"unknown_command" output in the netcat client.

**Havel Konda**

- owned: The gesture recognition and stabilization modules in the tmux companion prototype (`renderer/gestures.js`, `renderer/gesture-gate.js`, `shared/config.js`, `docs/MEDIAPIPE_RECOGNITION.md`, [PR #38](https://github.com/just1nlee/osu-capstone/pull/38)). They load the shared MediaPipe model, sample camera frames, and pass each prediction through a gate that requires a confidence threshold over several frames, a cooldown, and a release before the next action. Guarded commands, such as closing a pane, also require a continuous one-second hold.
- reviewed: Minimal command bus prototype ([PR #37](https://github.com/just1nlee/osu-capstone/pull/37/changes/49811a9b4bd951bb34340f6f71921e67f29f0e96)) and tmux gesture companion prototype ([PR #38](https://github.com/just1nlee/osu-capstone/pull/38))
- shipped: I shipped the gesture gate that decides when a pose becomes a tmux command, so a held gesture fires exactly once and destructive commands need a deliberate hold. We know it works because the gesture gate unit tests pass, and the Electron smoke test holds a synthetic pose past the cooldown and confirms that pane focus changes only once.

**Tobi Kohn**

- owned: The tmux integration, launcher, and tests for the tmux companion prototype (`electron/tmux.cjs`, `electron/dispatch.cjs`, `electron/session-selection.cjs`, `shared/commands.js`, `start-companion.sh`, `tests/tmux.integration.test.cjs`, `tests/app.test.cjs`, `.github/workflows/ci.yml`, [PR #38](https://github.com/just1nlee/osu-capstone/pull/38)). The companion discovers tmux sessions, resolves pane and window targets, and runs the mapped tmux command. The launcher starts tmux and the companion together on a shared socket. CI now runs the companion's unit, real-tmux integration, and Electron smoke tests on macOS with a synthetic recognizer, so no webcam or model file is needed.
- reviewed: Did not review anything.
- shipped: I shipped the path from a recognized gesture to a real tmux command, plus the CI that checks it on every push and pull request. We know it works because the integration tests run against disposable tmux servers, and the CI smoke test feeds a synthetic gesture through the companion and confirms that focus moves to another pane in a real tmux session.

**Farzaan Wadiwalla**

- owned: The Electron shell, IPC, and interface for the tmux companion prototype (`electron/main.cjs`, `electron/preload.cjs`, `electron/protocol.cjs`, `electron/settings.cjs`, `renderer/main.js`, `renderer/settings.js`, `renderer/debug.js`, `index.html`, `style.css`, `docs/GESTURE_MAPPINGS.md`, [PR #38](https://github.com/just1nlee/osu-capstone/pull/38)). The main process serves the app from a locked-down local origin, exposes a narrow IPC bridge to the renderer, and keeps running in the macOS menu bar when the window is closed. The renderer adds a gesture mappings panel that assigns a tmux command to each pose and saves the mappings to disk, along with the camera preview and MediaPipe diagnostics.
- reviewed: Did not review anything.
- shipped: I shipped the companion window and mappings panel, so anyone can map a gesture to a tmux command, check it, and save it without editing code. We know it works because the saved mappings reload after a restart, and in the demo video a mapped thumbs up switches focus between tmux panes.

**Decision chaired this sprint:** who drove which decision to a conclusion. Over a term everyone should appear here at least once.

- Farzaan Wadiwalla: drove the team's decision to settle what custom gestures we want to add to the gesture recognition model to map to multiplexer commands by 12/1.

## 3. Top Risk and Decisions

- **Top risk:** We've started building the command bus, but we haven't agreed on which commands the multiplexer will accept. The command schema is the contract between the gesture recognizer and the multiplexer. If it stays undefined, each side will build on its own assumptions, and the schema, parser, and gesture mappings will need rework once the two sides connect. The longer this waits, the bigger that rework gets, and the later we can show the first end-to-end demo of a gesture controlling the multiplexer.
- **Decision needed (from the team, by Tue 12/1):** Discuss and finalize what custom gestures we want to add to the gesture recognition model and what commands we want our custom multiplexer to support. This way, we can set up the command bus to accept these commands and begin looking into how to add custom MediaPipe gestures that will map to these commands.
- **Previous note's decision**: The team successfully settled on the programming language we will use for the MediaPipe gesture recognition model program 11/10/26, deciding on the Python API. Python was chosen because the entire team has prior experience with the programming language.

## 4. Judgment Layer (human-written, about five lines)

This sprint, we went into depth about how the individual modules we are working on will interact with one another. Through connecting the gesture recognition model to an existing terminal multiplexer, tmux, we realized that we need to create our own command schema since we don't plan to support all the commands that tmux has. We also learned that we will need to add more custom commands into our MediaPipe gesture recognition model, as the current ones that are built-in are not enough for the amount of commands we plan to implement. During our next sprint, we need to define the command schema and implement these into the command bus, so we can continue to progress and test our individual modules without stalling one another. For example, Farzaan, Havel, and Tobi can continue working on the gesture recongition model and the companion application by connecting to the command bus and verifying the print statement outputs, while Justin can implement the features that the command bus promises.
