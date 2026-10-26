# RFC-004: Choosing an Input Method for Gesture Control

Project 60: Vision-Based Gesture Control for Terminal Multiplexers

Farzaan Wadiwalla <wadiwalf@oregonstate.edu>

---

| Field         | Value                                                   |
| ------------- | ------------------------------------------------------- |
| Author        | Farzaan Wadiwalla                                       |
| Date          | 2026-10-25                                              |
| Status        | Proposed                                                |
| Decision Date | (fill when decided)                                     |
| Deciders      | Farzaan Wadiwalla, Havel Konda, Justin Lee, Tobias Kohn |
| Superseded By | (link, if applicable)                                   |

## Problem and Context

Project 60 uses physical gestures to control terminal multiplexers, allowing users to switch panes, change layouts, and execute commands without relying entirely on a keyboard. One of the first decisions is how to capture user input. We could use a glasses-mounted camera, a built-in webcam, an EMG band that detects muscle activity, or a hybrid approach that combines multiple input methods.

This decision affects more than recognition accuracy. It determines the hardware users need, how portable the system is, how much setup is required, and whether the interaction works outside a controlled environment. A glasses-mounted camera supports an egocentric view of the user's hands, while a webcam depends on the user's position and camera placement. An EMG band avoids relying on camera visibility but introduces wearable hardware and a different recognition pipeline.

This decision is relatively easy to reverse early in development, but becomes more expensive once the recognition pipeline, data collection, gesture mappings, and evaluation depend on a particular sensor. Switching input methods later could require new data, different preprocessing, and changes to the recognition model.

We need to choose an input method that supports a working MVP while remaining practical to implement and evaluate within the capstone timeline. If we do nothing, the team risks building recognition and integration components around an input method that does not fit the project's intended use.

## Options

### Option A: Glasses-Mounted Camera

Use a camera mounted on glasses to capture the user's hands from an egocentric perspective. The captured frames are processed locally by the gesture-recognition system.

- **Benefits:** Provides a first-person view of hand movements and supports hands-free interaction without requiring the user to remain in front of a desk-mounted camera. It aligns with the project's goal of exploring wearable, physical interaction.
- **Costs:** Requires suitable camera hardware and a mounting setup. Hand visibility, lighting, camera movement, and field of view may affect recognition. The team must also integrate and test the camera input pipeline.
- **Right choice when:** Wearable, hands-free interaction is central to the project and the team can obtain reliable camera hardware.

### Option B: Built-In Webcam

Use a laptop or external webcam to capture hand gestures in front of the user.

- **Benefits:** Easy to prototype with existing hardware and compatible with the team's current computer-vision direction. It lowers the initial hardware barrier and simplifies early testing.
- **Costs:** The user must remain within the camera's field of view and maintain a suitable position. Camera placement and background conditions may affect recognition, and the setup is less portable than a wearable camera.
- **Right choice when:** The priority is to validate gesture recognition and multiplexer integration quickly using readily available hardware.

### Option C: EMG Band

Use an electromyography (EMG) wearable to detect muscle activity associated with hand gestures rather than relying on camera images.

- **Benefits:** Does not depend on visual hand visibility or lighting and could support interaction when the hands are partially obscured. It provides an alternative input method for exploring wearable computer interaction.
- **Costs:** Requires compatible hardware, sensor-specific data processing, and a different recognition pipeline. Muscle signals can vary between users and sessions, and the team would need to learn and validate the relevant hardware and software interfaces.
- **Right choice when:** Camera-based input is insufficient for the intended interaction and the team has the time and hardware to validate EMG-based control.

### Option D: Hybrid Input

Combine two or more input methods, such as a camera for gesture recognition and an EMG band for additional signals or confirmation.

- **Benefits:** Could combine the strengths of different sensors and provide alternative ways to recognize or confirm user intent. It leaves room for future experiments with multimodal interaction.
- **Costs:** Adds hardware, integration work, synchronization requirements, and additional failure cases. The team would need to determine how conflicting inputs are resolved and whether the added complexity improves the user experience.
- **Right choice when:** Initial testing demonstrates that one input method has important limitations that another sensor can address.

### Option E: Do Nothing (Defer the Decision)

Continue experimenting with the recognition pipeline without committing to a primary input method.

- **Benefits:** Avoids committing to hardware before the team understands the recognition requirements.
- **Costs:** Makes it difficult to establish a consistent data collection and evaluation process. Camera and EMG approaches require different inputs and processing, so delaying the decision could create rework and reduce time available for integration.
- **Right choice when:** The team has not yet established the minimum hardware requirements for a meaningful prototype.

## Analysis

**Recognition reliability.** Camera-based approaches depend on image quality, hand visibility, lighting, and camera positioning. A glasses-mounted camera captures an egocentric view, while a webcam provides a more fixed view when the user is positioned correctly. EMG avoids visual limitations but introduces signal-processing and sensor-calibration challenges. We need to evaluate these approaches in the conditions relevant to our intended use rather than assume one is more reliable.

**Complexity and maintainability.** The current project direction uses computer vision and MediaPipe for hand recognition, making camera-based input the most direct path to an initial prototype. An EMG-based approach would require a different sensing and recognition pipeline. A hybrid system would add integration and testing requirements before we know whether multiple sensors provide enough benefit to justify the cost.

**Usability and portability.** A webcam is convenient for desk-based development but constrains where the user can stand or move. A glasses-mounted camera better supports wearable interaction but requires additional hardware and a suitable mounting setup. An EMG band avoids camera placement constraints but requires the user to wear and configure another device.

**Cost and scope.** A webcam offers the lowest barrier to experimentation when suitable hardware is already available. A glasses-mounted camera may better demonstrate the project's intended interaction, while an EMG band introduces hardware and integration dependencies. Supporting multiple input methods could expand the project's scope beyond what is practical for the capstone timeline.

**Uncertainties.** We have not established comparative measurements for recognition accuracy, latency, setup time, or usability across these input methods. The decision should be based on a working prototype and repeatable tests, not assumptions about which sensor will perform best.

## Recommendation and Verification Plan

I propose Option A, a glasses-mounted camera as the primary input method, with a built-in webcam used for early development and debugging when needed. This keeps the project aligned with its goal of wearable, hands-free interaction while allowing us to test the recognition pipeline before the full hardware setup is ready. I would defer EMG and multimodal input until testing demonstrates a specific limitation that justifies the additional work.

We will evaluate this approach through the following checks:

1. **Camera pipeline (before integration).** Verify that the selected camera can provide usable frames to the recognition system at a consistent resolution and frame rate under the intended setup.
2. **Recognition accuracy (before multiplexer integration).** Collect labeled examples of the selected gestures and measure per-gesture accuracy and confusion rates under different hand positions and lighting conditions.
3. **Latency (before the final demo).** Measure the time from a visible gesture to a recognized command, then measure end-to-end time from gesture input to the corresponding multiplexer action.
4. **Usability (before the final demo).** Have team members perform the same gesture tasks using the glasses-mounted camera and, where practical, a webcam. Record recognition failures, setup difficulties, and cases where the user's hands leave the camera's field of view.
5. **Fallback trigger.** If the glasses-mounted setup cannot provide reliable input within the project's time and hardware constraints, use the webcam as the primary input for the MVP and document the limitations of that choice.

These checks are proposed and have not yet been completed. The team should establish acceptance thresholds after collecting baseline results and record the measurements before deciding whether the input method meets the project's requirements.

## Constraints

**Licensing.** The current computer-vision direction uses MediaPipe, which is distributed under the Apache-2.0 license. Any additional hardware SDKs, recognition models, or supporting libraries must be checked for their licensing terms before adoption.

**Data use.** Camera frames should be processed locally and should not be stored or transmitted without a clear need. If recordings are required for evaluation, the team should limit collection to what is necessary and obtain consent from participants. An EMG approach would also require appropriate handling of sensor recordings.

**Intellectual property.** The team should document its input pipeline, hardware dependencies, and evaluation results in the repository. Any external datasets, SDKs, or sample code must be used according to their applicable licenses and data-use terms.

**Partner confidentiality.** This is a student-proposed project without an external partner or NDA. The team should still avoid collecting unnecessary personal video or sensor data.

## Delegation and Validation

- **What I handed to AI tools:** AI tools can help compare input methods, identify hardware and recognition tradeoffs, and suggest test cases for evaluating accuracy, latency, and usability.
- **What checks made that reasonable:** The proposed verification plan includes camera pipeline checks, recognition measurements, end-to-end latency tests, and comparative usability testing. These checks are not yet implemented and should not be treated as completed validation.
- **Where I validated the result myself:** I will confirm that the selected hardware works with our actual recognition pipeline, review the setup and dependencies, and inspect the test results before accepting the input method. The final decision should reflect what we can demonstrate with the available hardware and time, rather than unverified assumptions about sensor performance.

## Decision

Proposed. To be decided by team discussion and agreement.

## References

1. Google AI Edge. MediaPipe Hand Landmarker. https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker
2. Google AI Edge. MediaPipe Gesture Recognizer. https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer
