# RFC-003: Deciding When a Recognized Gesture Becomes a Terminal Command

Project 60: Vision-Based Gesture Control for Terminal Multiplexers

Havel Konda <kondah@oregonstate.edu>

| Field | Value |
| --- | --- |
| Author | Havel Konda |
| Date | 2026-10-25 (revised 2026-11-22) |
| Status | Proposed |
| Decision Date | Not yet decided (team vote pending) |
| Deciders | Farzaan Wadiwalla, Havel Konda, Justin Lee, Tobias Kohn |
| Superseded By | None |

## Problem and Context

Project 60 lets a developer rearrange a terminal multiplexer with hand gestures. A terminal multiplexer, such as tmux, splits one terminal window into panes that each run their own shell. A webcam watches the user's hand, a recognizer labels the pose, and the multiplexer opens, closes, or moves between panes. The people it serves keep many panes open and reorganize them often. Gestures handle navigation and layout only. The keyboard still does the actual work (`docs/requirements.md`, FR-10).

This RFC covers one narrow part of that system: how a stream of per-frame recognition results becomes individual commands. Which gestures exist, how the multiplexer is built, and how users remap gestures are separate decisions.

The problem comes from how the recognizer reports. MediaPipe's Gesture Recognizer returns a gesture category and a confidence score for every frame it processes [1][2]. At 30 fps, holding an open palm for two seconds yields about 60 identical results. A keyboard repeats a held key on purpose, but a held hand should not keep opening panes. The reverse also matters: one misclassified frame should not close a pane in the middle of someone's work. The requirements already treat this as a must-have. FR-3 says a held gesture produces exactly one command, and the same gesture fires again only after the hand releases it (`docs/requirements.md`, FR-3).

The decision is needed now because the team has already started building without sharing an answer. Three components exist, and each defines "one gesture event" differently. The Analysis section lists them. If we do nothing, the recognizer, the multiplexer integration, and the tests will each assume something different, and reconciling them will cost more once the walking skeleton depends on one of them. Where this logic lives matters more than its exact thresholds, since thresholds are config values and a misplaced component means rewriting integration code and tests.

## Options

### Option A: Fire on Every Recognized Frame

Send a command for every frame where MediaPipe reports a supported gesture above a confidence threshold. It is the least code and adds no delay. It breaks FR-3 directly: a held gesture repeats, and one bad frame triggers an action. Any repair falls to the multiplexer. It is the right choice only if gestures are never held, which a hand pose cannot guarantee.

### Option B: Require N Consecutive Frames

Accept a gesture only after it appears in N frames in a row. This removes one-frame misclassifications and stray movement. The delay is tied to frame rate: five frames take about 133 ms at 30 fps and about 267 ms at 15 fps. It also does not stop repeats, because once a gesture passes N frames, frame N+1 still matches. It is the right choice when commands are meant to repeat while held, for example scrolling, which this project excludes from gesture control.

### Option C: A State Machine With Release

Place a small component between the recognizer and command execution. It reads the label, confidence, and timestamp of each result. A gesture must stay stable for a minimum time in milliseconds, so behavior does not depend on frame rate. After it fires, it cannot fire again until the pose has been absent for a release time, so a single dropped frame during a hold does not re-arm it. Low confidence and lost tracking are handled in the same place, and a cooldown can be added if testing shows it is needed. The cost is a real component to design and test, including quick pose switches and short tracking losses. It is the right choice when FR-3 is a hard requirement, which it is here.

### Option D: Do Nothing for Now

Wait for a working prototype and decide from measurements. The risk is the drift described above: the integration is built on whatever each author assumed, and the team reconciles it later. It would be the right choice only if recognition were too unreliable to use, which our baseline results contradict (see Analysis).

## Analysis

**Evidence from this project.** Three implementations of "one gesture event" already exist:

- My recognizer module in the Electron prototype (`playground/mediapipe-example/renderer/gestures.js`, PR #25) requires a confidence threshold for several consecutive frames, then a cooldown and a release step.
- Farzaan's state machine (`interface/state_machine.py`, commit `ad7f85e` on `test/build-state-machine-for-input-mapping`) is time-based, with 500 ms of stability and 300 ms of release by default.
- Tobi's gesture gate (`playground/mediapipe_tmux_companion/renderer/gesture-gate.js`, on `main`) counts frames: its defaults are 2 frames at 5 fps, a 1000 ms cooldown, and two neutral frames to release.

These are three working answers to the same question, and `docs/design.md` describes a fourth, time-based design that follows this RFC. That is the integration drift Option D predicts.

I compared the three options on scripted sequences, not a camera, so no footage is needed (`docs/requirements.md`, C-4). The harness is in `playground/rfc003_gesture_filter/` on the branch `test/havel-rfc003-gesture-filter`. It feeds seven sequences at 30 and 15 fps to each option and counts the commands that fire. Option C passed 7 of 7, Option A 2 of 7, and Option B 3 of 7. On a two-second hold at 30 fps, A fired 60 commands, B fired 56, and C fired 1. Option B's first command arrived 133 ms after the gesture began at 30 fps and 267 ms at 15 fps. Option C's arrived at 167 ms and 200 ms, because its stability time is set in milliseconds. These numbers are the filters' own delay on scripted input, without MediaPipe's processing time or the multiplexer's.

I also ran the pretrained model on my webcam through the same filters (`live_demo.py` in that folder, 2026-11-22, one tester, one laptop, one session). Confidence varied by gesture. Open_Palm was seen in 411 frames with a mean score of 0.53 and a maximum of 0.70. Thumb_Up had a mean of 0.69, Closed_Fist 0.79, and Thumb_Down 0.70. With a 0.7 threshold, Open_Palm never fired while the other three did. I lowered the demo's threshold to 0.5, which let Open_Palm through. One global threshold fits the four gestures poorly, and per-gesture thresholds are likely. The log holds only labels, scores, and timestamps and is not committed.

Run against my scenarios with its defaults, Farzaan's state machine fires at about 500 ms and fired nothing for a hold with one dropped frame, because a dip while it is still waiting for stability resets its timer. That echoes Workshop 4's RC-2 (`docs/assignments/workshop-4.md`). It depends partly on my 500 ms hold lengths, so it is a finding to confirm. `docs/design.md` already specifies the tolerant behavior: in Candidate, a dropout shorter than the release time does not reset the timer.

**Evidence from outside the project.** MediaPipe's documentation describes the recognizer's output, a category and score per frame [1][2]. It does not publish latency or reliability figures for an application like ours, so those must come from our own measurements.

**Reliability.** Option A is the most exposed to accidental commands. B removes one-frame errors but still repeats. Only C tracks whether a gesture has already fired, which is what FR-3 requires. C does not fix a confident misclassification: in my scripted test a steady wrong label fired under every option, so the threshold and the recognizer remain the defense.

**Performance.** A adds no delay and B adds N frames, varying with the camera. C adds a fixed duration, which feels the same on any device. NFR-1 (provisional) sets a median of 300 ms, and 500 ms at the 95th percentile, from the moment a pose becomes stable to the visible layout change (`docs/requirements.md`). Check 5 defines that moment and measures to terminal write completion, so the stability wait sits outside NFR-1 but not outside what the user feels. Farzaan's 500 ms default alone would put the felt delay at 500 ms or more.

**Complexity and maintainability.** A is almost no code, B a small filter, and C a component with its own tests. C costs more up front but keeps every gesture rule in one place, so swapping the recognition model leaves the multiplexer untouched.

**Security and privacy.** All options run locally. The filter sees only labels, scores, and timestamps, never frames, and gestures never run arbitrary shell commands.

**Uncertainty.** I have no end-to-end latency, no repeated-trial accuracy, and no long-session false-activation rate. The harness thresholds are guesses, and the live run covers one person, camera, and lighting condition.

## Recommendation and Verification Plan

I recommend **Option C**, following the design in `docs/design.md` ("Gesture state machine"). A and B break a must-have requirement and push gesture logic into the multiplexer. The first version needs a per-gesture confidence threshold, a minimum stable time, a release time, and release-before-retrigger. Destructive commands get a higher threshold, as `docs/design.md` already says.

Each check names what counts as failure and can be run as written.

1. **Held gesture (synthetic, every change to the filter).** A two-second hold at 30 and 15 fps must produce exactly one command. Fails on any other count. Passes today in the harness.
2. **Dropout (synthetic).** A hold with one dropped frame, in both the Fired and Candidate states, must produce exactly one command. Fails if a Candidate dropout resets the timer. The harness covers only the Fired case so far, so a drop at 100 ms must be added for my filter.
3. **Stability (synthetic).** Low-confidence frames, a single wrong frame, and two seconds of lost tracking must produce zero commands. A quick switch must produce one command for the final pose only.
4. **Release and repeat (synthetic).** Hold, release for 500 ms, then hold again must produce exactly two commands.
5. **Stable pose to terminal write completion (live, NFR-1).** *Stable* is the frame timestamp `ts` at which the state machine enters Fired: the pose held above its threshold for the minimum stable time, with no absence reaching the release time. *Terminal write completion* is when the multiplexer's write of the frame showing the new focus or layout to the host terminal returns. It is a proxy for the visible change, because terminal paint cannot be observed. Both use one monotonic clock, with `ts` carried on the intent (the optional field proposed as RC-9 in `docs/assignments/workshop-4.md`). That is a protocol change, so both container owners review it (risk R-4). Run 50 trials on a team laptop, as NFR-1 specifies. It fails if the median exceeds 300 ms or the 95th percentile exceeds 500 ms. I also report onset to terminal write completion, which adds the stability wait.
6. **Per-gesture recognition (live, 20 attempts per gesture).** Each gesture must trigger the intended command in at least 18 of 20 attempts (NFR-3's 90% bar). I expect Open_Palm to fail first at the current thresholds.
7. **Unintended commands (live, 30-minute session).** At most one unintended command, counted from the log against my own report (SM-2). Above that, thresholds rise before gestures are added.
8. **Integration replay (headless, every change to the filter or protocol).** Replay recorded gesture events, as intent lines and never frames, into the socket of a headless multiplexer as defined in `docs/design.md` (Testing), and compare the layout tree and focused pane to the expected output. A hold replayed as 60 results must change focus once. It fails on any difference or a second change. It covers socket to layout tree only, so the NFR-1 figure comes from check 5. It cannot run yet: `terminal-emulator/bus/` has the command bus and intent parser but no layout tree or compositor.

Checks 1 to 4 and 8 run without a camera and belong in CI. At present CI runs only the companion app's tests, so these are not automated yet.

**Fallback.** Falling back to Option B would not work, because it fails FR-3. If check 6 fails after threshold tuning, the response is to widen the release time, add a cooldown, or use per-gesture thresholds, all of which stay within Option C. If check 5 misses its target, the clock starts after the filter has fired, so investigate dispatch and rendering first. The onset-to-write time shows how much delay the stability wait adds.

## Constraints

**Licensing.** MediaPipe is Apache-2.0 [3], and its license requires carrying the license text with redistributed copies. The filter itself uses only the Python standard library, so this decision adds no dependency. The live demo adds OpenCV, and its license must be checked before it is added to a release.

**Data use.** The confidentiality boundary in `AGENTS.md` and C-4 rule out committing or sharing video of a person. This decision changes the test design: checks 1 to 4 use scripted label and timestamp sequences, and the live checks log only labels, scores, and timestamps. The demo never writes frames to disk. A recording of a tester stays off the repository and out of AI tools.

**Intellectual property.** No new gesture dataset is needed, and any later one gets a license check first.

**Confidentiality.** The project is student-proposed with no partner or NDA, and the repository is public, so credentials and consent forms stay out of it.

## Delegation and Validation

**What I handed to AI tools.** For the draft, ChatGPT helped me research filtering approaches and Claude revised the prose. For this revision, Claude Code wrote the test harness and live demo from my direction, compared the existing implementations, and drafted this text.

**What checks made that reasonable.** The harness has 17 unit tests that pass, and every number in Analysis comes from running `run.py` and `live_demo.py`, not from the model's description. The branch rules require a teammate's review before anything reaches `main`. CI does not run this harness, so the unit tests are a manual check for now.

**Where I validated it myself.** First, I ran the live demo on my own laptop and read the score log, because the confidence threshold decides whether a gesture fires at all and the 0.7 default would have hidden Open_Palm entirely. Second, I checked the Farzaan and Tobi comparisons against their code, because a wrong claim about a teammate's work would mislead the decision. Third, I checked the state machine against the diagram and wording in `docs/design.md`, because the protocol and its tests are expensive to change later (risk R-4).

## Decision

**Status: Proposed.** The team has not voted. I ask the team to adopt Option C as described in the Recommendation, pending the live checks above. `docs/design.md` and Farzaan's `interface/` already build on it, so the team is acting on it ahead of a vote.

## References

1. Google AI Edge. *Gesture recognition task guide.* https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer
2. Google AI Edge. *GestureRecognizerResult API reference.* https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision/GestureRecognizerResult
3. Google AI Edge. *MediaPipe GitHub repository (Apache-2.0).* https://github.com/google-ai-edge/mediapipe

## Revision Log

Peer review was excused for this RFC. I received no instructor comments on the draft.
