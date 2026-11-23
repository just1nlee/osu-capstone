# RFC-004: Choosing an Input Method for Gesture Control

**Project 60: Vision-Based Gesture Control for Terminal Multiplexers**

| Field | Value |
|---|---|
| Author | Farzaan Wadiwalla |
| Date | 2026-11-22 |
| Status | Proposed |
| Decision Date | To be decided |
| Deciders | Farzaan Wadiwalla, Havel Konda, Justin Lee, Tobias Kohn |
| Superseded By | N/A |

## Problem and Context

Project 60 uses physical gestures to control terminal multiplexers, allowing users to switch panes and change layouts without relying entirely on a keyboard. The input method is a significant architectural decision because it determines the required hardware, recognition pipeline, portability, and user experience. The team initially explored camera-based recognition and now has a working webcam prototype. With the team and mentor agreeing to explore additional wearable input methods during Winter term, we need to determine whether a glasses-mounted camera, an electromyography (EMG) wearable, or a combination would improve the project enough to justify the additional cost and complexity.

The current baseline uses MediaPipe to recognize four gestures: `Open_Palm`, `Closed_Fist`, `Thumb_Up`, and `Thumb_Down`. The prototype connects to a companion application for debugging, configuration, and confidence scores, and to a mock multiplexer for testing. This gives us a working reference point rather than requiring us to choose based only on theoretical advantages.

The decision is still relatively reversible, but becomes more expensive as the team builds data collection, sensor-specific processing, and integration around one input method. If we do nothing, we retain a functional webcam-based direction, but lose the opportunity to evaluate whether wearable input better supports the project's intended hands-free interaction.

## Options

### Option A: Glasses-Mounted Camera

Use a wearable camera to capture the user's hands from an egocentric perspective, processing frames locally through the existing computer-vision pipeline.

- **Benefits:** Supports wearable interaction and does not require the user to remain in front of a desk-mounted camera. It can reuse much of the current MediaPipe recognition work.
- **Costs:** Requires compatible camera hardware, mounting, camera-stream integration, and testing under different lighting and movement conditions. Hands may leave the camera's field of view.
- **Right choice when:** The wearable camera provides reliable hand visibility and a meaningful usability improvement over the webcam without excessive hardware or integration cost.

### Option B: Built-In Webcam (Current Baseline)

Continue using the laptop or external webcam as the primary input method.

- **Benefits:** Already prototyped, inexpensive when existing hardware is available, and compatible with the current recognition pipeline. It provides a stable reference for evaluating alternatives.
- **Costs:** Requires the user to remain within the camera's field of view and maintain a suitable position. It is less portable and does not fully demonstrate wearable interaction.
- **Right choice when:** The wearable alternatives do not demonstrate enough improvement to justify switching, or the project needs to prioritize reliable completion of the MVP.

### Option C: EMG Wearable

Use a wrist-worn sensor to detect muscle activity associated with intentional gestures rather than relying on camera images.

- **Benefits:** Does not depend on hand visibility or lighting. It may recognize subtle movements and gestures when the hands are outside a camera's field of view. Meta's Neural Band demonstrates this approach for wearable device control [2].
- **Costs:** Requires compatible hardware, access to sensor data or an SDK, calibration, and a different recognition pipeline. Signal interpretation may vary between users and sessions. Some consumer products are not open development platforms.
- **Right choice when:** Camera-based recognition creates limitations that EMG can address and the team can obtain a device with sufficient developer access.

### Option D: Hybrid Camera and EMG

Combine camera recognition with EMG signals, using one sensor for gesture recognition and the other for confirmation or additional input.

- **Benefits:** Could combine visual hand information with muscle activity and provide more flexibility across interaction conditions.
- **Costs:** Adds hardware expense, synchronization, integration, and testing. The team must define how conflicting inputs are handled and demonstrate that the additional sensor improves reliability or usability.
- **Right choice when:** Testing identifies a specific limitation in one sensor that the other can address, and the improvement justifies the added complexity.

### Option E: Do Nothing (Defer Evaluation)

Keep the current webcam approach and do not pursue additional input methods this term.

- **Benefits:** Avoids new hardware costs and preserves time for recognition, multiplexer integration, and testing.
- **Costs:** Leaves the wearable interaction question unresolved and may limit the project's ability to demonstrate its intended hands-free experience.
- **Right choice when:** The team cannot obtain suitable hardware or cannot complete a meaningful comparison within the available timeline.

### Option Comparison

| Option | Hardware cost | Implementation effort | Main advantage | Main limitation |
|---|---|---|---|---|
| Glasses camera | Unknown; depends on device | Medium–High | Wearable visual input | Camera positioning and field of view |
| Webcam | Low if already available | Low | Existing working baseline | Requires hands in view |
| EMG wearable | Unknown; device-dependent | High | Works without visual hand tracking | New sensor and recognition pipeline |
| Hybrid | Highest | Very High | Multiple complementary signals | Integration and synchronization |
| Defer | None beyond current setup | Low | Preserves current progress | Does not evaluate wearable alternatives |

## Analysis

**Recognition reliability and performance.** MediaPipe's Gesture Recognizer supports live video input, gesture categories, hand landmarks, and configurable confidence thresholds [1]. This supports our current camera-based direction, but it does not establish how well a wearable camera will perform under different angles, movement, or lighting. EMG offers a different sensing approach: Meta describes its Neural Band as recognizing muscle activity even when the hand is outside a glasses camera's field of view [2]. These are different capabilities, not proof that one method is more accurate for our gestures. We need to compare them using the same tasks and measurable criteria.

Our initial webcam data provides a starting point, but it is not yet a controlled benchmark:

| Gesture | Attempts | Estimated correct | Estimated accuracy | Estimated latency | Average confidence |
|---|---:|---:|---:|---:|---:|
| `Open_Palm` | 15 | 14 | ~93.3% | ~35 ms | ~91.8% |
| `Closed_Fist` | 15 | 12* | ~80.0%* | Not measured | 89.1%† |
| `Thumb_Up` | 15 | 14 | ~93.3% | ~35 ms | ~94.2% |
| `Thumb_Down` | 15 | 14 | ~93.3% | ~35 ms | ~92.7% |
| **Overall** | **60** | **54** | **~90.0%** | **~35 ms** | **~91.9%** |

These are provisional planning estimates, not validated performance results. The `Closed_Fist` estimate is based on 334 live-stream output lines, including seven `Open_Palm` predictions; the logs do not identify individual attempts. Its 89.1% confidence is an average across predictions, not attempts. Latency was not measured from gesture presentation to recognition. The other values are approximate and should be replaced with measurements from a consistent testing procedure.

**Complexity and maintainability.** The webcam and glasses-camera approaches can reuse the current MediaPipe-based pipeline, although the camera acquisition and positioning code may differ. Google documents support for live camera streams and configurable gesture categories, making this a practical baseline [1]. EMG requires a separate sensor interface and signal-processing approach. For example, Mudra Pro advertises a developer kit with surface EMG, an IMU, and a Python SDK [3]. This is a relevant development-oriented product, but its pricing and availability need to be confirmed. A hybrid implementation should not be attempted until a single alternative demonstrates a clear benefit.

**Cost and usability.** The webcam has the lowest immediate cost because the team already has access to suitable hardware. Wearable camera costs depend on the selected device and whether it exposes a usable camera stream. EMG costs also depend on developer access: Meta lists a $199 Neural Band replacement, but it is compatible with Meta Ray-Ban Display and is not presented as a standalone development kit [4]. Mudra Pro is explicitly marketed as a developer kit, although pricing requires contacting the vendor [3]. We should not assume that consumer hardware can be integrated into our application simply because it supports gesture control.

**Decision criteria.** The team should first establish whether each candidate can provide usable input to our application. We should then compare recognition accuracy, false activations, end-to-end latency, setup time, comfort, portability, hardware availability, and implementation effort. The existing project requirements provide initial targets: at least 90% intended-command accuracy over 20 attempts per gesture, median response within 300 ms and 95th-percentile response within 500 ms, and no more than one unintended command during 30 minutes of normal keyboard use. These are project acceptance targets, not current results. A candidate should not replace the webcam solely because it performs better on one metric; it must meet the reliability and latency requirements while offering a meaningful usability improvement at a cost the team can support.

## Recommendation and Verification Plan

I recommend keeping the webcam as the MVP baseline while conducting a time-limited Winter evaluation of glasses-mounted camera and EMG input. The team should not commit to hybrid input unless testing demonstrates a limitation that requires both sensors. This preserves current progress while allowing the team to make an evidence-based decision about wearable interaction.

The evaluation should proceed in stages:

1. **Hardware feasibility:** Identify candidate devices, confirm availability, cost, SDK access, supported operating systems, and whether raw camera or sensor data can be accessed by our application. Do not begin full integration until these conditions are confirmed.
2. **Comparable recognition tests:** Test the same four gestures using each feasible input method. Record attempts, correct classifications, confusion between gestures, confidence where available, and failures under different positions and lighting conditions. Use at least 20 labeled attempts per gesture for each candidate.
3. **Latency and false-activation tests:** Measure from the moment a gesture is presented to the resulting application or multiplexer action. Report median and 95th-percentile latency. Run a 30-minute normal-use test to identify unintended commands.
4. **Usability comparison:** Have team members complete the same pane-control tasks with each feasible input method. Record setup time, comfort, portability, hand visibility constraints, and task completion time.
5. **Selection gate:** Retain the webcam unless an alternative meets the project's reliability and latency targets and demonstrates a meaningful usability benefit without exceeding available hardware and implementation resources. If no alternative meets the criteria, document the webcam's limitations and continue with the baseline.

## Constraints

**Licensing.** MediaPipe and any additional models, SDKs, and libraries must be reviewed for licenses that permit the intended use and redistribution. Hardware SDK terms must also be checked before adoption.

**Data use and privacy.** Camera frames should remain local and should not be written to disk or transmitted. The current design uses transient frames and derived landmarks for testing. EMG signals should receive similarly limited handling. Any participant recordings require consent and should collect only what is necessary.

**Intellectual property.** The team should document hardware dependencies, external SDKs, licenses, and evaluation results. Third-party code and datasets must follow their applicable terms.

**Partner confidentiality.** This is a student-proposed project without an external partner or NDA. Prof. Alexander Guyer serves as the project mentor. No partner-confidential information is involved.

## Delegation and Validation

**What I handed to AI tools:** I used Codex to help set up the MediaPipe model locally and support implementation and testing. AI tools may also help research candidate hardware, compare SDK capabilities, and propose test cases.

**What checks made that reasonable:** I tested and iterated on the local model, inspected its live predictions, and connected the recognition output to the companion application and mock multiplexer. PR #27 documents the model work, and PR #33 documents the state-machine work. These checks establish that the current prototype runs, but do not validate comparative hardware performance or the provisional accuracy and latency estimates.

**Where I validated the result myself:** I personally ran the model and checked its predictions and integration behavior. I will also verify hardware compatibility, inspect sensor outputs, and review the results of each comparative test before recommending a change. I will not treat AI-generated hardware comparisons or unverified benchmark claims as project evidence.

## Decision

**Proposed.** The team and mentor have agreed to evaluate wearable camera and EMG input methods during Winter term. The webcam remains the current baseline. The final input-method decision will be made after feasibility checks and comparative testing.

## References

1. Google AI Edge. [MediaPipe Gesture Recognizer](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer?tab=Web).
2. Meta. [EMG Wearable Technology](https://www.meta.com/emerging-tech/emg-wearable-technology/).
3. Mudra Wearable. [Mudra Pro Developer Kit](https://mudra-band.com/pages/mudra-band-pro).
4. Meta Store. [Meta Neural Band](https://www.meta.com/ai-glasses/accessories/neural-band/?variant=sand).
5. Project 60. [PR #27: Gesture Recognition Model](https://github.com/just1nlee/osu-capstone/pull/27).
6. Project 60. [PR #33: Gesture State Machine](https://github.com/just1nlee/osu-capstone/pull/33).
7. Project 60. [Requirements](https://github.com/just1nlee/osu-capstone/blob/main/docs/requirements.md) and [Design](https://github.com/just1nlee/osu-capstone/blob/main/docs/design.md).