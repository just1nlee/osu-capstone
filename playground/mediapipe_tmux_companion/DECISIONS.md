# Companion development decisions

These decisions apply to the standalone tmux experiment. The capstone’s team-approved architecture is recorded separately in [ADR-0001](../../docs/adr/0001-hybrid-multiplexer-architecture.md), and its production recognition-toggle question is recorded in [ADR-0002](../../docs/adr/0002-recognition-toggle-owner.md).

| Decision | Why it was made | What it means in practice |
| --- | --- | --- |
| Use a tmux-only Electron companion | The experiment tests adding gestures to a terminal workflow the user already has. | tmux owns its server, sessions, terminal rendering, and keyboard bindings. The companion owns capture, settings, and dispatch. |
| Use direct `execFile` calls with argv | One-shot commands cover discovery and the actions exercised by the prototype. Control mode needs a persistent client and stream handling, and an embedded terminal needs a PTY and renderer. | The app can attach its controls to an existing session without creating a tmux client. Some commands need a real terminal. |
| Discover a single configured local socket | A stable server identity is necessary to route a gesture safely. | Select one initial session automatically, present a dropdown for multiple sessions, and allow refresh after late startup. Keep existing selections across renames and clear them on loss. |
| Present diagnostics and fixed gesture rows side by side | Users can see recognition results while editing the gesture that produced them. | The seven supported poses start unassigned. Each row can retain a disabled binding. The installed tmux catalog supplies command choices. |
| Separate guided options from advanced argv | Many useful commands need a sensible default. Others, especially two-target commands, need information that syntax alone cannot infer. | Guide common cases such as pane cycling, renaming, and pane movement. Use **Check settings** and detailed failures for live prerequisites. Keep explicit flags available. |
| Store saved mappings atomically and validate again in main | Draft form state and old camera or session events can outlive their destination. | Use versioned JSON, revision checks, session tokens, and capture generations. Main constructs the command from the saved mapping. |
| Use an explicit guard and a continuous hold | Closing work and unfamiliar or server-wide commands have larger effects than a focus change. | The checkbox starts off and stays checked until cleared or quit. Each guarded gesture still needs a new hold. Verify live targets and protect the last pane for direct `kill-pane`. |
| Keep MediaPipe in a local Electron renderer | This prototype needs preview, diagnostics, and on-device recognition in the same app. | One camera stream feeds the local model. Only accepted gesture labels and state tokens go through the action IPC. Frames, landmarks, and diagnostic logs remain in renderer memory. |
| Use frame stabilization for this experiment | Compatibility with the original MediaPipe example simplifies reuse and comparison. | FPS, post-classification confidence, consecutive frames, and cooldown are adjustable. Product requirement FR-4 specifies stability measured by elapsed time. |
| Use the shared `test-model` artifact | The Python baseline and companion should use the same checkpoint and setup location. | Read `test-model/models/gesture_recognizer.task` from the checkout at runtime. The model is ignored by Git, and the companion carries no duplicate or fallback. The two runtimes can use different mode and hand-count settings. |
| Keep the app available in the menu bar | Recognition is useful while the user works in their terminal. | Close hides the UI. Lock, sleep, and user switch stop capture. Startup and return after those events require explicit camera enablement. |

## Deferred lifecycle options

The current spike allows targeting a detached session while that session still exists. Pausing on last detach, following a specific client, following the foreground terminal, monitoring display sleep independently of system sleep, and launching both processes through a dedicated wrapper remain possible follow-ups. The companion and tmux each keep their own process lifecycle.

See [tmux integration](docs/TMUX_INTEGRATION.md), [MediaPipe recognition](docs/MEDIAPIPE_RECOGNITION.md), and [gesture mappings](docs/GESTURE_MAPPINGS.md) for current behavior.
