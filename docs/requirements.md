# Requirements

Project 60: Vision-Based Gesture Control for Terminal Multiplexers. CS 461/462, Oregon State University, 2026 to 2027. Mentor: Prof. Alexander Guyer.

## Problem statement

Developers who work in a terminal multiplexer manage panes with prefix-key chords (in tmux, `Ctrl-b` then `%` to split, `Ctrl-b` then an arrow to move focus). The chords share the keyboard with the work itself, so every layout change interrupts typing, and the bindings are memorized per tool. This project tests whether deliberate hand gestures, seen by the laptop's built-in webcam, can take over pane navigation and layout while the keyboard stays on the actual work. The evidence so far is the team's own daily use of tmux and similar tools. Nobody outside the team has been observed or interviewed yet, so the problem is a hypothesis until the winter user sessions (risk R-10 in `docs/risks.md`).

## Status

No requirement below is implemented yet. The only runnable code is the scaffold in `playground/mediapipe-example`, which recognizes gestures in an Electron window but implements none of these requirements. Every requirement therefore keeps its acceptance criteria. When one is finished and a test named after it runs in CI, the test's name replaces its criteria.

**Validation.** The project has no external partner, so Prof. Guyer stands in for one. A requirement is **assumed** until the mentor or a user outside the team confirms it. Today every functional and non-functional requirement is assumed. Mark one **confirmed** in the pull request that records the confirmation, and say who confirmed it.

## Functional requirements

Priority labels use MoSCoW (Must, Should, Could), ranking how much the product needs each requirement, not the order it gets built in. Build order lives on the board.

### Recognition

- **FR-1** (Must: every gesture feature depends on it): The recognizer reads frames from the laptop's built-in webcam and reports, for each processed frame, the hand pose it sees and a confidence score.
  Acceptance: given a recorded landmark sequence for each supported pose, the recognizer reports that pose with a confidence above the configured threshold.
- **FR-2** (Must: a misfire interrupts the user's work): A low-confidence result, an unknown pose, or a frame with no hand produces no command.
  Acceptance: given a sequence of frames below the threshold, of an unsupported pose, or with tracking lost, no command is emitted.
- **FR-3** (Must: without it, one held pose fires dozens of commands): A held gesture produces exactly one command, and the same gesture fires again only after the hand releases it.
  Acceptance: holding a supported pose for 3 seconds emits one command. Releasing it and performing it again emits a second command.
- **FR-4** (Must: a stray frame must not count as a gesture): A gesture fires only after the pose stays stable for a configured minimum time, measured in milliseconds rather than frames, so it behaves the same at 15 fps and 30 fps.
  Acceptance: a pose held for less than the minimum time emits nothing. The same pose sequence replayed at 15 fps and at 30 fps emits the same commands.

### Pane control

- **FR-5** (Must: the walking skeleton is this one action): A gesture moves focus to the next pane.
  Acceptance: with two panes open and the left one focused, the focus-next gesture moves focus to the right pane, and keyboard input then goes to the right pane.
- **FR-6** (Must: the second action a user needs after focus): A gesture splits the focused pane, starts the user's login shell in the new pane, and focuses it.
- **FR-7** (Should: rearranging is in scope, but focus and split come first): A gesture switches the window to the next preset layout, without restarting any process running in a pane.
  Acceptance: a long-running process (for example `top`) keeps running, with the same process ID, before and after the layout change.
- **FR-8** (Should: closing a pane ends its process, so a misfire costs work): A gesture closes the focused pane, but only at a higher confidence threshold than navigation gestures use.
  Acceptance: a close-pane result between the navigation threshold and the destructive threshold emits no command. A result above the destructive threshold closes the pane.
- **FR-9** (Must: a malformed command must never corrupt the layout): The multiplexer rejects an unknown command, a missing or invalid field, or an unsupported protocol version, and leaves the layout unchanged.
  Acceptance: each of those four cases leaves the pane tree and the focused pane identical to their state before the command arrived.

### Keyboard and terminal

- **FR-10** (Must: the keyboard does all actual work, and the camera is optional): Every pane action that a gesture can trigger can also be triggered by a key binding. The multiplexer works fully with no camera and no recognizer running.
  Acceptance: with the recognizer stopped, key bindings split, focus, change the layout, and close panes.
- **FR-11** (Must: the user keeps the terminal they already use): The multiplexer runs inside an existing terminal emulator, and full-screen programs render correctly in its panes.
  Acceptance: in at least two terminal emulators, `vim` and `btop` render in a pane with no corrupted cells, and resizing the host window reflows the panes.

### Feedback and control

- **FR-12** (Should: a user who cannot see what was recognized cannot correct a misfire): After each command, the multiplexer shows the recognized gesture and the resulting command for at least 1 second.
- **FR-13** (Should: users need to switch off the camera without quitting their work): The user turns gesture recognition on and off with one key binding, without restarting the multiplexer. While recognition is off, the camera is released.
  Acceptance: after the toggle, the operating system's camera-in-use indicator turns off.
- **FR-14** (Could: a convenience on top of FR-13): A desktop companion app registers a system-wide hotkey that turns on the camera and opens a debug view showing the camera feed, the current gesture, and its confidence. Closing the app leaves the multiplexer running.
- **FR-15** (Could: useful, but the default mapping must work first): The user remaps which gesture triggers which command in a configuration file, and the mapping survives a restart.

## Non-functional requirements

These follow the ISO/IEC 25010 checklist. Interaction capability and flexibility are measured as success metrics instead, because they need users outside the team. The numbers marked **provisional** are the team's first estimates and get reset from the baseline of the recognizer spike (risk R-2, due 2026-11-17).

- **NFR-1** (Must: a gesture slower than the keyboard has no reason to exist), performance, provisional: From the moment a pose becomes stable, the layout change appears on screen within 300 ms at the median and 500 ms at the 95th percentile, over 50 trials on a team laptop.
- **NFR-2** (Should: users won't adopt a multiplexer that slows their output), performance: Printing a 10 MB text file in a pane takes no more than twice as long as printing it in the host terminal without the multiplexer.
- **NFR-3** (Must: below this, users stop trusting the gestures), reliability, provisional: Each supported gesture triggers its intended command in at least 90% of 20 attempts, per tester, on three different laptops under normal indoor lighting.
- **NFR-4** (Must: a misfire interrupts work), reliability, provisional: Over 30 minutes of normal keyboard work with recognition on and no gestures attempted, the recognizer emits at most one command.
- **NFR-5** (Must: video of people is the project's one sensitive asset), security: No camera frame is written to disk or sent over the network. Only labels, scores, timestamps, and derived landmark coordinates leave the recognizer.
  Acceptance: during a 10-minute session, the recognizer process opens no connection to another host and writes no image or video file.
- **NFR-6** (Must: terminal contents can include secrets), security: The channel that carries commands into the multiplexer accepts connections only from the user running it.
  Acceptance: a second local user account cannot connect to it.
- **NFR-7** (Must: the team cannot test what it cannot run without a camera), maintainability: The recognizer's command logic and the multiplexer's layout logic each run their tests in CI with no camera, no display, and no human input.
- **NFR-8** (Must: the fall deployment milestone is an outside install), compatibility: A release build installs from GitHub Releases on a macOS machine outside the team in under 15 minutes, by following the release notes alone.

## Constraints

These are limits the team did not choose and cannot drop. They carry no priority label.

- **C-1 Course schedule.** The walking skeleton must install on a machine outside the team by fall week 10 (2026-11-30 to 2026-12-06), and Repo Checkpoint 2 checks it in that week. Week 9 (2026-11-23 to 2026-11-29) is Thanksgiving week.
- **C-2 Mentor agreement.** The project is student-proposed, so the production target needs Prof. Guyer's agreement in place of a partner's (risk R-12).
- **C-3 Hardware.** Development and testing use the team members' own laptops and built-in webcams. The project has no dedicated camera hardware and no lab machine.
- **C-4 Camera data.** Video of a recognizable person may not be committed, shared, or sent to an AI tool, under the confidentiality boundary in `AGENTS.md`. Only derived coordinate output may leave the machine that captured it, so tests and fixtures use landmark data, never frames.
- **C-5 Testing with people.** Sessions with people outside the team are subject to whatever approval the course requires, which is still being confirmed (risk R-15).
- **C-6 Third-party licenses.** Every dependency, model, and dataset must carry a license that allows redistribution in a public repository and a public release.
- **C-7 macOS distribution.** macOS Gatekeeper blocks or warns on downloaded apps that are not signed and notarized. Signing requires a paid Apple Developer Program account, which nobody funds today (risk R-9).

## Success metrics

The team set these before collecting any data. Each one is measured in the winter user sessions, or at the point named.

- **SM-1 Gestures are worth using.** For a fixed task of five pane actions (split, focus, change layout, focus, close), the median gesture completion time across participants is no more than 1.5 times the median keyboard completion time for the same task in tmux. Collected with a stopwatch log per participant. Decision rule: above 1.5 times, the team rescopes the gesture set before adding anything else (risk R-10).
- **SM-2 Gestures don't get in the way.** Unintended commands average at most 1 per 30 minutes of session time, counted from the recognizer's command log (labels and timestamps only) against the participant's own report. Decision rule: above that rate, raising the confidence and stability thresholds takes priority over new gestures.
- **SM-3 Someone else can run it.** By fall week 10, at least one person outside the team installs the release build and completes the FR-5 focus action without help from the team (risk R-13). Collected as a written report in a repository issue.

## Non-goals

- Gesture control of anything beyond navigation and layout: no scrollback search, copy mode, text editing, or typing by gesture.
- Running arbitrary shell commands from a gesture.
- Wearable and EMG input this year, including the glasses-mounted camera, unless the team and the mentor agree to bring it in scope.
- An agent-driven command path, such as an MCP server or an AI agent sending commands to the multiplexer, this year.
- Feature parity with tmux: detaching and reattaching sessions, remote sessions, and a scripting language.
- A hosted service or user accounts. The product runs entirely on the user's machine.
- Collecting a gesture video dataset.

## Open questions

- **Which gestures map to which commands?** Owner: Farzaan Wadiwalla. Answered by the recognizer spike, 2026-11-17, before FR-5 is built.
- **Do we use MediaPipe's predefined gestures (RFC-002) or our own classifier on hand landmarks (risk R-8)?** Owner: Tobias Kohn. Decided by 2026-11-17, from the same spike.
- **What are the final numbers for NFR-1, NFR-3, and NFR-4?** Owner: Farzaan Wadiwalla. Set from the spike baseline by 2026-11-24.
- **Does the product support only macOS, or Linux as well?** Owner: Justin Lee. Decided by 2026-11-22, before the first pre-release.
- **Which license does the repository use?** Owner: Justin Lee. Decided by team vote before the first pre-release, 2026-11-22.
- **Does closing a pane by gesture (FR-8) belong in the product at all, or only by keyboard?** Owner: Havel Konda. Decided after the first team testing of FR-5 and FR-6, by 2026-12-04.
