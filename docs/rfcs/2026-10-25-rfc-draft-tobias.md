
<!-- docs/rfcs/2026-10-25-tobiaskohn-rfcdraft.md -->

# RFC: Supporting Custom Hand Gestures and Configurable Keybindings

| Field | Value |
| --- | --- |
| Author | Tobias Kohn |
| Date | 2026-10-25 |
| Status | Proposed |
| Decision Date | |
| Deciders | Project development team |
| Superseded By | |

## Problem and Context

Our project is a terminal multiplexer that incorporates real-time hand gesture recognition to control the application through hand movements as opposed of relying exclusively on keyboard inputs. We have selected Google's MediaPipe Gesture Recognizer as our hand gesture recognition framework. The system will detect gestures through a camera and map recognized gestures to keyboard shortcuts that control multiplexer functionality, such as switching between terminal panes, creating new panes, or navigating between sessions.

MediaPipe's Gesture Recognizer identifies 21 landmarks on a hand: `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Down`, `Thumb_Up`, `Victory`, and `ILoveYou`. While the detection model can extract coordinates from other hand configurations, the classifier cannot reliably identify new, user-defined gestures unless additional classification capabilities are introduced. [1]

We want users to be able to customize the gesture controls of the multiplexer. This includes both changing which keyboard shortcuts are associated with existing gestures and potentially defining entirely new gestures. Remapping an existing gesture only requires modifying the application's gesture-to-keybinding configuration. However, recognizing a new gesture requires extending or replacing the gesture classification functionality. We must decide whether to restrict customization to the predefined gestures, retrain the MediaPipe classifier to recognize additional gestures, or implement a separate classifier using MediaPipe's extracted hand landmarks.

This decision must be made before implementing the gesture customization system because the chosen approach will influence the recognition pipeline, configuration format, and user interface. If we do nothing, the application can still provide gesture-based controls, but users will be restricted to a fixed set of gestures and actions. Although the decision is initially reversible, changing the classification architecture after users have registered custom gestures could require migrating stored gesture data and modifying the application's recognition pipeline.

## Options

### Option A: Remap Predefined MediaPipe Gestures

Users could customize the keyboard shortcuts associated with MediaPipe's seven predefined gestures without modifying the classifier. For example, `Thumb_Up` could initially switch terminal panes but be reassigned to create a new pane.

This approach requires only a configurable mapping between gesture identifiers and application commands. It introduces minimal computational overhead and avoids additional machine learning development.

However, users would remain limited to seven recognized gestures. They could change what gestures do but could not create new ones.

**This option is appropriate** if the team prioritizes simplicity, reliability, and meaningful customization without introducing model training.

### Option B: Train a Custom MediaPipe Gesture Classifier

MediaPipe provides a customization workflow through Model Maker, allowing developers to train classifiers on labeled gesture images. MediaPipe extracts hand landmarks from these images and trains a classifier recognizing additional gesture categories. The resulting model can be exported as a `.task` bundle. [2]

Users could record multiple examples of a gesture, label them, and use them to train an updated model. The new gesture could then be assigned a keyboard shortcut.

This approach supports genuinely new gestures while remaining within MediaPipe's classification architecture.

However, registering gestures requires collecting training data, training and validating models, and managing model updates. Retraining may affect recognition of previously supported gestures, requiring regression testing. Additionally, MediaPipe Model Maker has been deprecated, creating long-term maintenance concerns. [2]

**This option is appropriate** if supporting entirely new gestures is essential and the team can manage the additional training infrastructure.

### Option C: Do Nothing

The application would retain MediaPipe's predefined gestures with fixed keybinding mappings selected by the development team.

This requires no customization infrastructure, allowing the team to prioritize core multiplexer functionality and gesture recognition reliability.

However, users could neither change existing mappings nor define new gestures. As additional multiplexer actions become available, this limitation could reduce usability and require future architectural changes.

**This option is appropriate** if customization falls outside the project's scope or core functionality must take priority.

## Analysis

**Performance:** Options A and C introduce no additional classification overhead. Option B requires training when users register gestures and may affect inference latency as gesture categories increase. Actual performance must be benchmarked.

**Complexity:** Option A requires only a configuration system mapping recognized gestures to shortcuts. Option B requires collecting labeled samples, training models, handling ambiguous gestures, and updating deployed classifiers. Option C requires no additional development.

**Maintainability:** Option A separates recognition from application behavior, making modifications straightforward. Option B introduces model versioning, training data management, and regression testing. Model Maker's deprecation increases dependency risks.

**Security and reliability:** Incorrect classification could trigger unintended terminal commands. Both customization approaches require confidence thresholds, gesture stability checks, and cooldowns to prevent repeated execution. Option B additionally risks confusion between visually similar gestures.

**Cost:** Option A has relatively low development and maintenance costs. Option B requires substantially more engineering and potentially additional computational resources. Option C minimizes immediate costs but limits future functionality.

An alternative is implementing an independent classifier using MediaPipe's extracted landmark coordinates. For example, k-nearest neighbors could compare hand landmark vectors with user-recorded examples without retraining MediaPipe. However, normalization, classification accuracy, and ambiguity handling would become our responsibility.

We have not benchmarked custom classifier accuracy or latency, so Option B's practical feasibility remains uncertain.

## Recommendation and Verification Plan

I recommend **Option A: Remap Predefined MediaPipe Gestures** for the initial implementation.

This provides meaningful customization without requiring model retraining or additional classification infrastructure. The gesture recognition and keybinding mapping components should remain separate so custom classifiers can be introduced later without redesigning action execution.

We would verify this approach through the following tests:

1. **Recognition:** Confirm MediaPipe recognizes all seven predefined gestures.
2. **Customization:** Verify users can reassign gestures and trigger their configured shortcuts.
3. **Persistence:** Confirm mappings survive application restarts.
4. **Reliability:** Test across different users, camera angles, and lighting conditions.
5. **Safety:** Ensure unknown or low-confidence gestures do not execute commands, and held gestures do not repeatedly trigger actions.
6. **Performance:** Measure gesture-to-command latency against the unmodified recognition pipeline.
7. **Extensibility:** Confirm gesture classification and command execution remain independent components.

These tests should occur during implementation and before integration into the main application. If predefined gestures prove insufficient, the team should reconsider custom classification.

## Constraints

**Licensing:** MediaPipe uses the Apache 2.0 license. Additional frameworks or datasets must have compatible licenses.

**Privacy:** Camera input should be processed locally where feasible, without storing raw video. Option A requires no gesture training data.

**Intellectual property:** Future custom training datasets must comply with applicable usage and distribution licenses.

**Confidentiality:** This decision requires no partner-confidential information. Any restricted implementation details must be excluded from public documentation.

**Technical:** Recognition must remain responsive and prevent unintended or repeated command execution.

## Delegation and Validation

AI tools assisted with researching MediaPipe's capabilities, comparing customization approaches, and drafting this RFC. Google's official documentation was used to distinguish landmark detection, gesture classification, and keybinding configuration.

The analysis has not yet been validated through prototypes or performance benchmarks. Custom classifier training remains an unverified possibility for our application.

Before accepting the recommendation, I will independently review the MediaPipe documentation and discuss technical tradeoffs with the team. We should validate the architecture through a prototype demonstrating configurable gesture-to-keybinding mappings.

**Repository validation:** [Describe existing tests, CI checks, or review processes actually used.]

**Personal validation:** [Describe documentation, code, or prototype results personally verified.]

## Decision

**Status: Proposed**

The recommendation is to support configurable keybinding mappings for MediaPipe's seven predefined gestures without implementing custom model training initially.

The decision remains open pending team review. If new user-defined gestures become essential, the team should reconsider extending the gesture classification system.

## References

[1] Google AI Edge. *Gesture recognition task guide.*  
https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer

[2] Google AI Edge. *Gesture Recognizer customization guide.*  
https://ai.google.dev/edge/mediapipe/solutions/customization/gesture_recognizer

[3] Google AI Edge. *GestureRecognizerOptions API reference.*  
https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision/GestureRecognizerOptions

[4] Google AI Edge. *GestureRecognizerResult API reference.*  
https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision/GestureRecognizerResult

[5] Google AI Edge. *MediaPipe GitHub repository.*  
https://github.com/google-ai-edge/mediapipe
