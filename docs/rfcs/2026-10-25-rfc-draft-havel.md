# RFC: Deciding When a Recognized Gesture Becomes a Terminal Command

Project 60: Vision-Based Gesture Control for Terminal Multiplexers

Havel Konda <kondah@oregonstate.edu>

| Field | Value |
| --- | --- |
| Author | Havel Konda |
| Date | 2026-10-25 |
| Status | Proposed |
| Decision Date | |
| Deciders | Farzaan Wadiwalla, Havel Konda, Justin Lee, Tobias Kohn |
| Superseded By | |

## Problem and Context

Our capstone project uses a camera to recognize hand gestures that control navigation and layout in a terminal multiplexer. The keyboard still handles typing and actual terminal work. We plan to use Google's MediaPipe Gesture Recognizer to classify gestures and pass the results to the multiplexer.

This RFC covers one question: how continuous recognition results become individual command events. Which gestures we support, how users customize them, and how the multiplexer is built are separate decisions.

Gestures don't behave like key presses. Holding a key down repeats on purpose. Holding your hand still shouldn't keep creating panes. The recognizer reports the same pose on every frame it processes, so at 30 fps, holding Open_Palm for two seconds can produce around 60 results. If each one fires a command, a single held gesture opens a wall of panes. One misclassified frame could also close a pane or steal focus in the middle of someone's work.

We need to decide whether recognition results trigger commands directly or pass through a filtering component that decides when a gesture counts and when the next command can be accepted.

Where this logic lives matters more than the exact thresholds. Thresholds are config values. Moving event handling later means rewriting integration code and tests.

We don't have a working prototype or measured accuracy yet, so every latency and reliability claim below is a prediction we still have to verify. If we skip this decision, each of us will build against a different idea of what one gesture event is.

## Options

### Option A: Execute on Every Recognized Frame

Send a command whenever MediaPipe recognizes a gesture above a confidence threshold.

It's the least code and adds almost no delay.

It also has the exact problem described above: a held gesture repeats, and one bad frame triggers an action. Fixing that falls to the multiplexer or whatever sits downstream, which spreads gesture logic across components.

### Option B: Require a Stable Gesture Across Multiple Frames

Only accept a gesture after it appears in N consecutive frames. This filters out one-frame misclassifications and stray hand movement.

The cost is latency, and it's tied to frame rate. At 30 fps, five consecutive frames span about 133 ms. On a 15 fps laptop webcam, they span about 267 ms.

It also leaves the held-gesture problem in place. Once a gesture passes N frames, frame N+1 still matches.

### Option C: Use a State Machine for Gesture Events

Add a separate component between the recognizer and command execution. It takes gesture labels, confidence scores, and timestamps. It tracks whether a gesture has been stable long enough and whether it has already fired.

A gesture has to stay stable for a minimum duration measured in milliseconds, so it behaves the same at any frame rate. Once it fires, it can't fire again until the hand releases it. We can add a cooldown if testing shows we need one. Low-confidence results and lost tracking get handled in the same place.

The cost is complexity. We have to define the states and transitions, including edge cases like switching gestures quickly or losing the hand for a few frames.

### Option D: Do Nothing

Postpone until a basic prototype works and choose based on real data. This keeps the team focused on getting the camera and recognizer running.

The risk is integration drift: components get built on different assumptions about what triggers a command, and we reconcile them later.

## Analysis

**Reliability:** This is the main reason the decision matters. Option A fires on every accepted frame, so it's the most exposed to accidental commands. Option B removes one-frame errors but still repeats on a held gesture. Option C is the only option that tracks whether a gesture already fired, which is what actually stops the repeat. C still needs testing for missed releases, tracking loss, and confident misclassifications, since a wrong label held steadily will pass any stability filter. Option D defers the question, and in the meantime whoever writes the multiplexer integration will probably default to A.

**Performance:** A adds no delay. B adds N frames, which varies by camera. C adds a fixed minimum duration, so it feels the same on every device. MediaPipe's documentation covers recognition results and confidence scores, not end-to-end latency for our application [1, 2], so we need prototype numbers.

**Complexity and maintainability:** A is almost no code and B is a small filter. C is a real component with its own tests. That's more work up front, but it keeps every gesture-handling rule in one place. If we swap the recognition model later, the multiplexer doesn't change. With A or B, new reliability requirements would end up patched into multiple components.

**Security and privacy:** Options A through C all run locally without storing footage. The filter only sees labels, scores, and timestamps. Gestures stay limited to navigation and layout and never execute arbitrary shell commands.

**Cost:** None of the options need paid services. The cost is development and testing time.

The open question is whether C's reliability gain is worth its latency and complexity. Testing answers that.

## Recommendation and Verification Plan

I recommend **Option C**. A and B would push filtering logic into the multiplexer, and we'd end up rewriting it as soon as someone holds a gesture for more than a second.

The first version should use a configurable confidence threshold and minimum stability duration, plus release-before-retrigger.

Tests we'll run:

1. **Repeated commands:** Hold a gesture and confirm it fires once until you release it.
2. **Recognition stability:** Feed in a few wrong or low-confidence frames and confirm nothing fires.
3. **Gesture release:** Release a gesture, perform it again, and confirm it fires a second time.
4. **Camera disconnect:** Drop frames or unplug the camera and confirm nothing else fires.
5. **Performance:** Measure the time from a stable gesture to the command executing.
6. **Integration:** Replay recorded gesture events against the multiplexer and check that the pane layout changes as expected.

Initial acceptance criteria: a held gesture produces exactly one command, and low-confidence results or lost tracking produce none.

We'll run the same sequences against each approach to compare latency and false activation rates, then set numerical targets from the first prototype's baseline. After that, the tests run whenever the filtering logic changes.

If the state machine adds too much delay or keeps missing intended gestures, we revisit the filtering rules or fall back to a simpler approach.

## Constraints

**Licensing:** MediaPipe is Apache 2.0 [3]. The filtering component needs no other third-party libraries, and any we add later get a license check first.

**Data use:** Camera footage is processed locally. The team's `AGENTS.md` prohibits committing or sharing identifiable camera frames with AI tools, and only derived coordinate data may be committed or shared. The state machine can be tested entirely with synthetic gesture sequences, so no raw footage needs to be stored.

**Intellectual property:** This decision doesn't require collecting or distributing a new gesture dataset. If we bring in an external dataset later, we check its license before using it.

**Confidentiality:** Project 60 is student-proposed and has no external partner or NDA. The repository is public, so credentials, consent forms, and identifiable camera footage stay out of it.

**Project scope:** Gesture controls are limited to terminal navigation and layout. The system won't use gestures for text editing or arbitrary shell command execution. Architectural changes need team approval and an ADR.

## Delegation and Validation

**What I handed to AI tools:** I used ChatGPT to help research gesture filtering approaches, compare technical tradeoffs, and draft sections of this RFC. I used Claude to revise the prose and add concrete examples.

**What checks made that reasonable:** The repository requires human review, and architectural changes require team approval. We don't have a working prototype or automated tests yet, so the tests in this RFC are planned checks, not completed ones.

**Where I validated the result myself:** I read through our project docs and my teammates' RFCs so this one wouldn't overlap with theirs. I also checked the options against what MediaPipe's docs say the recognizer actually returns.

## Decision

**Status: Proposed**

Adopt Option C as described in the Recommendation, pending team review and prototype testing.

## References

1. Google AI Edge. *Gesture recognition task guide.*  
   https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer

2. Google AI Edge. *GestureRecognizerResult API reference.*  
   https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision/GestureRecognizerResult

3. Google AI Edge. *MediaPipe GitHub repository.*  
   https://github.com/google-ai-edge/mediapipe