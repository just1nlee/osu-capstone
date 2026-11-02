# Sprint Note: Sprint 1, Project 60: Vision-Based Gesture Control for Terminal Multiplexers

<!-- One page maximum. Each numbered section is graded pass/fail (20 points each).
     The evidence may be AI-generated from your repo history and board.
     Two things must be human-written: section 5, and the "shipped" sentence
     in each contribution line. Those are the parts anyone reads. -->

**Team:** Project 60: Vision-Based Gesture Control for Terminal Multiplexers
**Sprint dates:** 10/12/2026 to 10/25/2026
**Date submitted:** 10/25/2026

## 1. Working Software Evidence

- **Deployed URL / release tag / demo video:** No runnable code yet; this sprint went to the architecture and gesture-recognition design, and the first runnable piece (a single terminal emulator) is next sprint’s milestone.
- **Demo video timestamps:** N/A
- **CI run:** Not yet configured.

## 2. What Got Done

- **Where the work is tracked:** https://github.com/just1nlee/osu-capstone/issues?q=is%3Aissue
- **Done this sprint:**
  - Set up the repository with branch protection and required reviews
  - Created issues for the repository using GitHub Issues
  - RFC-001 (Justin): compares Electron, native C, and hybrid architectures for the multiplexer and recommends a native C multiplexer with an optional Electron companion app ([PR #1](https://github.com/just1nlee/osu-capstone/pull/1)).
  - RFC-002 (Tobi): defines how users add custom hand gestures and map them to configurable keybindings ([PR #2](https://github.com/just1nlee/osu-capstone/pull/2)).
  - RFC-003 (Havel): proposes a state machine between the recognizer and the multiplexer so a held gesture fires exactly one command and low-confidence frames fire nothing ([PR #4](https://github.com/just1nlee/osu-capstone/pull/4)).
  - RFC-004 (Farzaan): compares glasses-mounted camera, webcam, EMG, and hybrid input and recommends a glasses-mounted camera with a webcam for early development ([PR #10](https://github.com/just1nlee/osu-capstone/pull/10)).

## 3. Top Risk and One Decision Needed

- **Top risk:** The multiplexer architecture is still undecided, so the multiplexer core can't start in Sprint 2. Until it does, the command bus protocol stays undefined, the gesture-recognition work is built against a guessed interface, and Sprint 3's gesture integration has nothing to connect to.
- **Decision needed (from the team, by Wed 10/28):** Vote on RFC-001 (`docs/rfcs/2026-10-25-rfc-draft.md`) to choose the multiplexer architecture: Electron, native C, or hybrid (native C plus an optional Electron companion app).

## 4. Contribution Lines

**Justin Lee**

- owned: RFC-001: Electron vs CLI native vs Hybrid for Multiplexer Architecture [PR #1](https://github.com/just1nlee/osu-capstone/pull/1)
- reviewed: RFC-003: Deciding When a Recognized Gesture Becomes a Terminal Command [PR #4](https://github.com/just1nlee/osu-capstone/pull/4), RFC-004: Choosing an Input Method for Gesture Control [PR #10](https://github.com/just1nlee/osu-capstone/pull/10)
- shipped: RFC-001 recommends a hybrid architecture, a native C multiplexer that runs in any terminal plus an optional Electron companion app, which gives the team a concrete proposal to vote on so the multiplexer core can start in Sprint 2. I confirmed the hybrid is feasible by running tmux inside VS Code’s xterm.js terminal and checking that Electron’s globalShortcut API can register a system-wide hotkey.

**Havel Konda**

- owned: RFC-003: Deciding When a Recognized Gesture Becomes a Terminal Command [PR #4](https://github.com/just1nlee/osu-capstone/pull/4)
- reviewed: RFC-001: Electron vs CLI native vs Hybrid for Multiplexer Architecture [PR #1](https://github.com/just1nlee/osu-capstone/pull/1), RFC-002: Supporting Custom Hand Gestures and Configurable Keybindings [PR #2](https://github.com/just1nlee/osu-capstone/pull/2)
- shipped: RFC-003 proposes a state machine between the recognizer and the multiplexer so that a held gesture fires exactly one command and low-confidence frames fire nothing, which gives everyone one shared definition of a “gesture event” to build against. I checked the design against what MediaPipe’s docs say the recognizer actually returns.

**Tobi Kohn**

- owned: RFC-002: Supporting Custom Hand Gestures and Configurable Keybindings [PR #2](https://github.com/just1nlee/osu-capstone/pull/2)
- reviewed: Did not review anything.
- shipped: RFC-002 recommends letting users remap MediaPipe’s seven built-in gestures to their own keybindings instead of training a custom classifier, so we get real customization without model training, while keeping recognition and keybindings separate so custom gestures can be added later. It hasn’t been prototyped yet, but MediaPipe’s official docs confirm the built-in gesture set and show that Model Maker, the tool needed for a custom classifier, is deprecated.

**Farzaan Wadiwalla**

- owned: RFC-004: Choosing an Input Method for Gesture Control [PR #10](https://github.com/just1nlee/osu-capstone/pull/10)
- reviewed: Did not review anything.
- shipped: RFC-004 recommends a glasses-mounted camera as the primary input, with a webcam for early development, so the recognition pipeline can start on hardware we already have without giving up the wearable goal. It hasn’t been validated yet, the first check is confirming the camera delivers usable frames to MediaPipe with the webcam as the fallback if it doesn’t.

**Decision chaired this sprint:** who drove which decision to a conclusion. Over a term everyone should appear here at least once.

- Justin Lee: drove the team's decision to settle the multiplexer architecture by a majority vote on RFC-001, by 10/28.

## 5. Judgment Layer (human-written, about five lines)

This sprint, we learned that building a reliable gesture-controlled terminal multiplexer requires more than selecting a gesture recognition model. The recognition approach, application architecture, and communication between components will all affect the complexity of the final system. RFC-001 proposes a hybrid architecture direction for a team vote, however we still need to finalize this decision and validate our gesture recognition approach. Next sprint, we will prioritize getting a basic gesture recognition prototype working before expanding into terminal integration. This will help us identify technical limitations early and make architecture decisions based on working evidence rather than assumptions.
