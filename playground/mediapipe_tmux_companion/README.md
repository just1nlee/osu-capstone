# MediaPipe tmux Companion

The companion uses your webcam to trigger commands in a local tmux session. Keep using tmux in your usual terminal. The companion window shows MediaPipe diagnostics and gesture mappings side by side. Closing the window moves the companion to the macOS menu bar, where you can turn the camera off, reopen the window, or quit.

[Architecture and development](#architecture-and-development) · [Topic guides](#documentation)

## Start

Install Node.js 22.12 or newer and tmux. Set up `test-model/models/gesture_recognizer.task` once per checkout to enable camera recognition. The companion and Python baseline read that same file. You can open the app for settings and tmux discovery while the model file is absent. [Model download and checksum](docs/MEDIAPIPE_RECOGNITION.md#shared-model-and-setup)

Run these commands from the repository root on macOS.

~~~sh
brew install tmux
cd playground/mediapipe_tmux_companion
npm ci
./start-companion.sh
~~~

[The launcher](start-companion.sh) creates or reuses the `work` session on the named socket `gesture-demo`, starts the companion on that socket, and attaches your terminal. The companion selects `work` automatically when it is the only session on the server. If several sessions share that socket, choose one in the companion’s dropdown. The camera starts off on a fresh launch.

If the companion is already using another socket, quit it from the menu bar before running the launcher. A second launch reopens the existing instance with its current socket and selection. Startup output goes to `${TMPDIR:-/tmp}/tmux-companion.log`.

### Start tmux and the companion separately

Run `npm start` from the companion directory to open the companion on its own. It uses the default tmux socket unless you set it explicitly.

Start tmux from your normal terminal with **tmux new-session -s work** or attach to an existing session. If the companion is already open, click **Refresh sessions**. If the first nonempty session list contains one entry, the app selects it automatically. With multiple entries, choose one in the dropdown. Detached sessions also appear. The app keeps a valid selection across renames and new sessions. If the selection is lost, choose a session explicitly to resume gesture actions.

To use a named server, point the terminal and companion at the same socket. Run the tmux and npm commands in separate terminals, with the npm command run from the companion directory. An explicit socket path uses `tmux -S` and `TMUX_COMPANION_SOCKET_PATH`. [Socket selection](docs/TMUX_INTEGRATION.md#discovery-and-selection)

~~~sh
tmux -L gesture-demo new-session -s work
~~~

~~~sh
TMUX_COMPANION_SOCKET_NAME=gesture-demo npm start
~~~

## Set up a gesture

1. In **Gesture mappings**, pick a tmux command from the dropdown for the pose you want. Every row starts with **No command**. You can use the same command for multiple poses.
2. Fill in any fields the command shows. For example, **select-pane** cycles focus with no extra input and **rename-window** needs a new name. **move-pane** uses your active pane and asks where to move it. Select the next pane in the current window, or the active pane in the next or previous window.
3. Click **Check settings** to resolve the target without running the command. For a first test, split a disposable tmux window into two panes and map **Thumb up** to **select-pane**.
4. Click **Save mappings**. Turn the camera on from the window or menu bar. Watch the selected tmux window, form the pose, then release it before repeating. Gestures can fire while the terminal is unfocused or detached if the session still exists. Uncheck **Enabled** and save to pause a gesture while keeping its command.

**Advanced options** shows tmux's installed usage and accepts one argument per line. A command can require another pane, window, attached client, or interactive terminal. tmux can also reject a command after a successful check if the session changes. The MediaPipe log includes the failure reason. Explicit targets, server-wide commands, and commands that take nested commands can affect other sessions on the selected server.

**Allow closing and guarded commands** starts unchecked each launch. It stays checked until you clear it or quit. Guarded gestures require a continuous one-second hold after stabilization. Changing targets or disabling recognition cancels a pending hold. Direct **kill-pane** also protects the only pane in a window. Quit leaves the tmux server and its shells running.

The window shows the local preview, gesture, confidence, handedness and landmarks in the full result, inference timing, and the last action. Freeze output holds the displayed result. The log and inference continue. Camera capture stops when you turn it off, quit, lock the screen, or put the Mac to sleep. Turn it on again after unlocking or waking. If macOS blocks the camera, check **System Settings → Privacy & Security → Camera**.

## Architecture and development

The companion runs from source on macOS with Electron 45.1.0 and MediaPipe Tasks Vision 0.10.35. tmux owns the terminal and its sessions. Electron owns the camera, diagnostics, mappings, and invocation of the local tmux CLI.

### Entry points and ownership

| Path | Responsibility |
| --- | --- |
| [electron/main.cjs](electron/main.cjs) | Starts the single-instance app, creates the window and tray, publishes state, and runs the IPC handlers. |
| [electron/preload.cjs](electron/preload.cjs) and [electron/protocol.cjs](electron/protocol.cjs) | Expose a fixed IPC bridge and serve allowlisted local assets, including the shared model. Main permits video capture only for the trusted app frame while camera capture is enabled. |
| [electron/session-selection.cjs](electron/session-selection.cjs) and [electron/tmux.cjs](electron/tmux.cjs) | Reconcile session discovery and selection. Resolve the executable, query tmux, collect live targets, and run argv through `execFile`. |
| [electron/settings.cjs](electron/settings.cjs) and [electron/dispatch.cjs](electron/dispatch.cjs) | Save mappings to disk and track their revision in memory. Validate incoming gestures against that revision, camera state, and selected session, then prepare and run the action. |
| [renderer/index.html](renderer/index.html), [renderer/main.js](renderer/main.js), and [renderer/style.css](renderer/style.css) | Mount and style the two panels, render the published state, and connect local gesture detection to IPC. |
| [renderer/gestures.js](renderer/gestures.js), [renderer/gesture-gate.js](renderer/gesture-gate.js), [renderer/debug.js](renderer/debug.js), and [renderer/settings.js](renderer/settings.js) | Own the camera stream, inference, gesture stabilization, in-memory diagnostics, slider values, and unsaved mapping edits. |
| [shared/config.js](shared/config.js) and [shared/commands.js](shared/commands.js) | Define the common mapping schema, command form metadata, target preparation, and guard classification. |

Main publishes the saved mapping snapshot and tracks the selected session and camera state. The renderer handles the video and sends a stabilized pose label with the current mapping revision, target token, and capture generation. For example, a saved guided `Thumb_Up` → `select-pane` mapping in session `$3` and window `@2` yields `['select-pane', '-t', '$3:@2.+']`. Main verifies the live target and passes the arguments to the tmux adapter, which prepends the socket and CLI options. [Recognition pipeline](docs/MEDIAPIPE_RECOGNITION.md#from-video-to-a-gesture) · [Command dispatch](docs/TMUX_INTEGRATION.md#command-dispatch)

### IPC contract

The preload exposes `window.gestureCompanion`. Invoke channels use the `companion:` prefix and return `{ ok: true, ... }` on success or `{ ok: false, code, message }` on failure. A mapping validation failure can also identify the affected gesture. Main checks the sender and frame before handling an invocation.

| Method | Input | Success payload beyond `ok` |
| --- | --- | --- |
| `getState()` | None | Full snapshot |
| `refreshSessions()` | None | Full snapshot. Discovery errors appear in `sessions.status` and `sessions.message`. |
| `selectSession(key)` | Opaque session key from the current list | Full snapshot |
| `listCommands()` | None | `commands`, an array of `{ name, usage }` |
| `saveMappings(value)` | Complete versioned mappings document | Saved `mappings` and `revision` |
| `checkMapping(request)` | `{ gesture, binding, targetToken }` | `target` summary and `guarded`. The check does not execute the command. |
| `setCameraEnabled(enabled)` | Boolean | `camera` state |
| `reportCameraStatus(status)` | `{ captureGeneration, phase }`. Accepted phases are `starting`, `loading`, `on`, and `error`. | No additional fields |
| `setGuardUnlocked(unlocked)` | Boolean | `unlocked` |
| `dispatchGesture(request)` | `gesture` label, `revision`, `targetToken`, `captureGeneration`, and for a guarded gesture, `phase` and `holdId` | `command` after execution. Guard begin and cancel acknowledge without running a command. |

Subscribe with `onStateChanged(listener)` before the initial state read. It listens for `companion:stateChanged` and returns an unsubscribe function. Each full snapshot includes `mappings`, `revision`, optional `notice`, `sessions`, `camera`, `guardUnlocked`, `sequence`, `catalogEpoch`, and `windowVisible`. The renderer ignores older sequences. A changed catalog epoch signals it to reload command metadata.

`sessions` contains `status`, a list of `{ key, name, attachedClients }`, `selectedKey`, `targetToken`, and an optional `message`. `camera` contains `enabled`, `captureGeneration`, and `phase` (including `off`). Guarded dispatch uses `begin`, `commit`, and `cancel`. The fresh tokens let main reject work from a previous session, save, or capture run.

### Lifecycle

| Event | Camera | Gesture dispatch |
| --- | --- | --- |
| Launch | Starts off. | Awaits camera activation and a valid selection. |
| Hide or minimize the companion, or switch foreground apps | Leaves capture as configured. | Continues when the camera and target are eligible. |
| Close the terminal while the same tmux session survives | Leaves capture as configured. | Keeps the session selected. Commands that need an attached client can fail. |
| tmux session ends or server becomes unavailable | Leaves capture as configured. | Clears the lost selection and cancels pending holds. Diagnostics can continue, and dispatch awaits another selection. |
| Turn the camera off, lock the screen, suspend, switch macOS users, or reload or lose the renderer | Stops capture. | Cancels pending holds. Turn the camera on explicitly to resume. |
| Quit the companion | Releases capture. | Ends companion dispatch. tmux sessions can keep running. |

The guard is an in-memory setting. A fresh launch starts locked. Turning off the camera or changing the selected target cancels holds while preserving the checkbox state. Actions tmux has already accepted may still complete. [Guard rules](docs/GESTURE_MAPPINGS.md#advanced-options-and-guard) · [Deferred lifecycle choices](DECISIONS.md#deferred-lifecycle-options)

### Changing or debugging a command

Start in [shared/commands.js](shared/commands.js). `getCommandForm` describes the guided fields, `validateBindingOptions` checks saved inputs, and `prepareCommand` resolves live targets and builds argv. Add a fixture to [tests/commands.test.mjs](tests/commands.test.mjs) that asserts the expected argv and the error for a missing prerequisite. Add a disposable-server test in [tests/tmux.integration.test.cjs](tests/tmux.integration.test.cjs) when changing tmux targeting or behavior. Guard classification is shared by the renderer and main. Use **Check settings** to inspect the target without running the command.

On a bad settings file, the app opens with defaults and leaves the file on disk. To reset mappings through the UI, choose **No command** for the affected rows and save. For a complete reset with a backup, quit first and rename `gesture-mappings.v1.json` in the app’s Electron `userData` directory. [Storage and schema](docs/GESTURE_MAPPINGS.md#persistence-and-dispatch-payload)

## Verify

Run these from the companion directory after `npm ci`. The [repository CI workflow](../../.github/workflows/ci.yml) runs the first three suites on macOS with Node.js 22 and tmux. No webcam or shared model file is required for those checks.

~~~sh
npm test
npm run test:tmux
npm run test:app:ci
npm run test:app
~~~

- **npm test** covers selection, persistence, command preparation, gesture stabilization, hold timing, and shared model routing.
- **npm run test:tmux** uses real disposable tmux servers to check discovery, target resolution, pane moves, error reporting, close safeguards, and launcher session reuse.
- **npm run test:app:ci** launches Electron and uses a synthetic recognizer to feed gesture results through the renderer, IPC, and dispatcher. It verifies that a held gesture changes focus once in a real tmux session with an attached client, even when the companion window is hidden. It also checks discovery, settings persistence, and tmux survival on quit. Run it locally on a graphical macOS desktop with Python 3 and tmux.
- **npm run test:app** needs the shared model file, a graphical macOS desktop, Python 3, and a real tmux binary. It checks Electron startup, IPC, settings, local MediaPipe inference with generated video, and background dispatch with a tmux client attached to a test PTY. It injects a synthetic pose label into one part of the test. A physical-camera and real-pose check is a separate manual step.
- Set `TMUX_TEST_BINARY` to the absolute path of a tmux executable to run against that version. Without it, the integration suite resolves tmux through its normal binary lookup, and the app smoke test uses tmux on `PATH`.

For a manual camera check, use a disposable two-pane session and map **Thumb up** to guided `select-pane`. Confirm that holding the pose fires once, that a release allows it to fire again, and that hiding the companion still permits dispatch. Test screen lock and sleep with capture enabled, then confirm the camera stays off on return until you re-enable it. End the selected session and check that the picker requires a fresh selection. Keep these checks separate from the automated synthetic-input results.

## Documentation

- [tmux integration](docs/TMUX_INTEGRATION.md)
- [MediaPipe model setup, inference, and tuning](docs/MEDIAPIPE_RECOGNITION.md)
- [Gesture mappings, advanced options, and safeguards](docs/GESTURE_MAPPINGS.md)
- [Development decisions](DECISIONS.md)
- [Implementation plan and verification history](IMPLEMENTATION_PLAN.md)
