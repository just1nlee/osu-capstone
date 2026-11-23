# RFC-004: Supporting Custom Hand Gestures and Configurable Keybindings

Project 60: Vision-Based Gesture Control for Terminal Multiplexers

Tobias Kohn <kohnto@oregonstate.edu>

| Field         | Value                                                   |
| ------------- | ------------------------------------------------------- |
| Author        | Tobias Kohn                                             |
| Date          | 2026-10-25 (revised 2026-11-22)                         |
| Status        | Proposed                                                |
| Decision Date |                                                         |
| Deciders      | Farzaan Wadiwalla, Havel Konda, Justin Lee, Tobias Kohn |
| Superseded By | None   

## Problem and Context

Our project is a terminal multiplexer that incorporates real-time hand gesture recognition to control the application through hand movements as opposed of relying exclusively on keyboard inputs. We have selected Google's MediaPipe Gesture Recognizer as our hand gesture recognition framework. The system will detect gestures through a camera and map recognized gestures to keyboard shortcuts that control multiplexer functionality, such as switching between terminal panes, creating new panes, or navigating between sessions.

MediaPipe's Gesture Recognizer identifies 21 landmarks on a hand and classifies 7 gestures: `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Down`, `Thumb_Up`, `Victory`, and `ILoveYou`, as well as `None`. While the detection model can extract coordinates from other hand configurations, the classifier cannot reliably identify new, user-defined gestures unless additional classification capabilities are introduced. [1]

We want users to be able to customize the gesture controls of the multiplexer. This includes both changing which keyboard shortcuts are associated with existing gestures and potentially defining entirely new gestures. Remapping an existing gesture only requires modifying the application's gesture-to-keybinding configuration. However, recognizing a new gesture requires extending or replacing the gesture classification functionality. We must decide whether to restrict customization to the predefined gestures, retrain the MediaPipe classifier to recognize additional gestures, or implement a separate classifier using MediaPipe's extracted hand landmarks.

This decision must be made before implementing the gesture customization system because the chosen approach will influence the recognition pipeline, configuration format, and user interface. If we do nothing, the application can still provide gesture-based controls, but users will be restricted to a fixed set of gestures and actions. Although the decision is initially reversible, changing the classification architecture after users have registered custom gestures could require migrating stored gesture data and modifying the application's recognition pipeline.

## Options

### Option A — Use a pretrained classifier for more still gestures

Use the HaGRIDv2 authors’ MobileNetV3 Small classifier to recognize additional still poses from the HaGRIDv2 dataset, such as OK and grip. The classifier receives the live webcam feed as a series of 224 × 224 RGB images and labels each frame independently. It processes the whole image, including the background, so the classification stage does more work than a small model operating on hand coordinates. The published weights avoid a training project, but we would still have to package a runtime, select an initial set of supported poses, and decide which predictions are reliable enough to act on. [2]

The team could try a wider set of gestures with relatively little training effort. The available choices would come from the published model, so changing the vocabulary beyond those labels would need a different model or further training. Each supported label would be eligible for a user-configured binding.

**This option is appropriate if** the pretrained vocabulary includes comfortable poses that users want and the full-frame pipeline meets our speed and reliability requirements on team laptops.

### Option B — Train our own still-gesture classifier on HaGRIDv2

Use MediaPipe Hand Landmarker to locate the hand and pass its coordinates to a classifier we train. HaGRIDv2 publishes per-hand MediaPipe landmark annotations alongside its image labels. We could use the existing coordinate records directly and train a small model on a selected set of one-handed poses. This approach gives the team control over the vocabulary and keeps the classification stage much smaller than a full-frame image model. Hand tracking still runs at inference, and we would need coordinate normalization between training and live use. [2, 3]

The team would choose the label set, handle missing landmarks, and validate each model release. HaGRIDv2’s subject splits give us a starting point for checking whether training transfers to people outside the training set. The model would be trained by the team. Users could remap the supported poses through the same configuration available in Option D. [2, 6]

**This option is appropriate if** users need more still poses and the team can maintain a small classifier tailored to the multiplexer.

### Option C — Train still and dynamic classifiers on HaGRIDv2 and IPN HandS

Use HaGRIDv2 for still poses and IPN HandS for movements such as directional throws. HaGRIDv2 supplies individual labeled hand shapes. IPN HandS supplies sequences of hand coordinates with labeled start and end frames, including intervals with no intended gesture. We could use one MediaPipe tracker and start with two classifiers. One would read a single frame of coordinates and the other would read a short sequence. A shared model with separate outputs is possible, but it would still need to handle both kinds of labels and inputs. Separate heads make it easier to train and update the still and motion vocabularies independently. [2–5]

This adds decisions about when a movement starts and finishes, how long to retain coordinate history, and which prediction takes precedence if a supported pose occurs during a motion. Otherwise, one deliberate movement could trigger a still-pose action and then a motion action. The first candidate would be a directional gesture for pane focus. [4, 6]

**This option is appropriate if** users benefit from a directional movement enough to justify separate motion training and more complex activation logic.

### Option D — Do nothing to recognition and allow binding customization

Keep MediaPipe’s seven predefined still gestures and let the user choose which multiplexer function each one triggers. A user could assign thumbs up to split the focused pane, for example. The team would provide default mappings and support saving, changing, or disabling individual bindings. Our tmux companion prototype already demonstrates these mapping operations for its supported poses. The recognition vocabulary stays limited to the built-in poses, so users who find those poses difficult still have the keyboard controls. [1, 6, 8]

**This option is appropriate if** users can find comfortable poses in the built-in vocabulary and can get the flexibility they need by reassigning actions.

## Analysis

**Performance.** D is the existing inference baseline. A processes full RGB frames, while B feeds a much smaller coordinate vector into its classifier. The total cost of B still includes MediaPipe’s hand tracking, so a smaller classifier alone does not establish lower end-to-end latency. C also has to observe enough of a movement to distinguish its direction. A quick model prediction can still produce a slow interaction if the system has waited too long to fill the input window. For a meaningful comparison, measure the time until a pane changes on screen and report model inference time separately. [1–6]

**Engineering effort and maintenance.** A avoids model training but adds a dependency and a checkpoint we would have to package and test on macOS. B adds a labeled-data pipeline and model versioning, but lets us limit the classifier to poses users can distinguish reliably. C has the most work because two kinds of training data need preparation and changes to one head can affect which output wins during a movement. Keeping recognition labels internal and binding them to existing pane actions limits the migration cost. The recognizer can change while the multiplexer continues to receive the same pane intents. D has the smallest recognition maintenance burden, and the remaining mapping work has a working prototype to build from. [2, 4, 6, 8, 9]

**Recognition and accidental actions.** Our recorded closed-fist run contains 327 fist predictions and seven open-palm predictions across 334 outputs. IPN HandS offers labeled background intervals, but its published landmark classifier was evaluated on segmented gestures with background excluded. The paper supports the feasibility of recognizing motions from coordinates. Our own tests must establish whether a live recognizer can stay quiet during ordinary typing and fire once per deliberate gesture. [4–7]

**Privacy and release cost.** Each option can process frames locally. B and C can train from published landmark annotations and use coordinate-only fixtures for recognizer tests. A needs an RGB input at runtime, so its camera-to-classifier path must keep frames in memory. A also requires confirming the terms for the published weights. B and C require confirming the HaGRIDv2 data terms and what they permit for a public release of the trained model. If those rights cannot be established, the HaGRIDv2 paths remain research comparisons for this decision. [2, 4, 6, 10]

## Recommendation and Verification Plan

I recommend **Option B** for the first expansion of gesture recognition. A classifier trained on HaGRIDv2 landmarks lets us choose a small set of comfortable, distinguishable poses and keep their bindings configurable. The walking skeleton only needs to move focus to the next pane, which a still pose can handle. Start with that action and use the built-in MediaPipe recognizer from Option D as a baseline. [1–3, 6–9]

1. **Build and hand-test all four prototypes.** Use the same laptops, pane layout, and tasks for A through D. Try each prototype with deliberate gestures and ordinary typing. Record correct, missed, wrong, and duplicate actions. Check that a held pose fires once and that a remapped binding survives a restart. For C, test a directional throw and a still pose on the same pane-focus task. Note which is easier to repeat and whether the motion accidentally fires a still binding. [6, 8, 9]
2. **Measure dataset accuracy.** After the hand tests, run A, B, and the still classifier from C on the same HaGRIDv2 test images for the gesture labels they share. Report accuracy for each gesture and overall. Evaluate C’s motion classifier separately on labeled IPN HandS landmark sequences. Keep test participants separate from training and tuning, and document which HaGRIDv2 split the published A checkpoint was evaluated on. [2–5]
3. **Measure `None` accuracy and compare settings.** Use a separate set of images and videos expected to produce no gesture, including typing, idle hands, unsupported poses, and scenes with no hand. For each prototype, report the percentage of negative examples correctly classified as `None` and, for video, the number of accidental commands. Run the automated and hand tests across relevant settings such as confidence thresholds, hold times, and C’s motion window length. Cross-validate those hyperparameters by rotating which participants are held out for validation in both the automated and live tests. Compare settings on the same examples or tasks within each split. Confirm the selected settings on a separate test set and fresh live trials. [4–6]
4. **Compare end-to-end latency.** Run 50 trials per option with the selected settings and report median and 95th-percentile times from a stable pose to the visible pane redraw on the same hardware. For C, also measure from the start and from the end of a motion to the redraw so the comparison captures time spent making the gesture. Use the project’s provisional still-pose targets of 300 ms median and 500 ms at the 95th percentile. [6, 9]

Compare live results against the provisional targets of 18 correct attempts out of 20 per gesture per tester and at most one unintended command in 30 minutes of typing. Run tests locally and verify that camera frames stay in memory. If a pose fails, try another pose or setting and retest. Keep B if motion offers no clear benefit or misses the reliability or latency targets. Use D as the fallback if B cannot meet the release requirements. [6, 9, 10]

## Constraints

**Licensing and redistribution.** For A, we must verify that the specific HaGRIDv2 checkpoint can be redistributed. For B and C, we must review the HaGRIDv2 terms for the annotations used in training and for release of the resulting weights. The repository links a customized license, and the paper describes research use. The IPN HandS release explicitly lists CC BY 4.0 for its annotations and landmarks. D keeps the existing MediaPipe model, whose LiteRT distribution identifies the canned bundle as Apache 2.0. [2, 4, 6, 10, 11]

**Camera data and confidentiality.** The recognizer processes locally and keeps webcam frames in memory. Development and test logs should contain labels, scores, timestamps, or derived coordinates as needed. Recognition tests can replay labaled training or recorded data in CI. [6, 9]

## Delegation and Validation

AI tools assisted with researching MediaPipe's capabilities, finding existing resources for Options A, B, and C, and identifying pros and cons of each option.

The analysis has not yet been validated through prototypes or performance benchmarks. Custom classifier training remains an unverified possibility for our application.

The team read through each resources documentation to verify facts and weigh in on technical tradeoffs.

**Repository validation:** An existing validation pipeline tests the ability for our companion app to communicate with tmux, but does not validate Mediapipe output.

## Decision

**Status: Proposed**

The proposal is **Option B** for the first expansion of gesture recognition. Train a still-gesture classifier on HaGRIDv2 landmarks and let users bind supported poses to existing pane actions. Adopt Option C if directional throws improve pane navigation and meet the verification targets. Keep Option D as the fallback if the HaGRIDv2 model cannot meet the release requirements. Team acceptance is pending.

## References

1. Google AI Edge. [MediaPipe Gesture Recognizer task guide](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer). (Accessed 10/25/26)
2. HaGRID authors. [HaGRIDv2 dataset, annotations, models, and demo](https://github.com/hukenovs/hagrid). (Accessed 11/22/26)
3. Google AI Edge. [MediaPipe Hand Landmarker task guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker). (Accessed 10/25/26)
4. Benitez-Garcia et al. [IPN HandS landmark and temporal annotation release](https://github.com/GibranBenitez/IPN-hand/blob/master/README_HandS.md). (Accessed 11/22/26)
5. Benitez-Garcia et al. [IPN HandS paper and landmark classifier evaluation](https://www.mdpi.com/2076-3417/15/11/6321). (Accessed 11/22/26)
6. Project 60. [Project requirements](https://github.com/just1nlee/osu-capstone/blob/8e7589f340179fff5e221b818cc74f776eba3fe2/docs/requirements.md).
7. Project 60. [Baseline model results and measurement notes](https://github.com/just1nlee/osu-capstone/blob/8e7589f340179fff5e221b818cc74f776eba3fe2/test-model/baseline-model-results.md).
8. Project 60. [tmux companion gesture mappings](https://github.com/just1nlee/osu-capstone/blob/8e7589f340179fff5e221b818cc74f776eba3fe2/playground/mediapipe_tmux_companion/docs/GESTURE_MAPPINGS.md).
9. Project 60. [Architecture, pane intents, and recognizer test strategy](https://github.com/just1nlee/osu-capstone/blob/8e7589f340179fff5e221b818cc74f776eba3fe2/docs/design.md).
10. HaGRID authors. [Dataset license](https://github.com/hukenovs/hagrid/blob/master/license/en_us.pdf) and [HaGRIDv2 paper, ethical considerations](https://arxiv.org/html/2412.01508v1#S8). (Accessed 11/22/26)
11. LiteRT Community. [MediaPipe Gesture Recognizer bundle and license](https://huggingface.co/litert-community/MediaPipe-GestureRecognizer). (Accessed 11/22/26)
