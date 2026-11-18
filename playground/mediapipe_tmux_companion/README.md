# MediaPipe tmux Companion

The companion uses your webcam to trigger commands in a local tmux session. Keep using tmux in your usual terminal. The companion window shows MediaPipe diagnostics and gesture mappings side by side. Closing the window moves the companion to the macOS menu bar, where you can turn the camera off, reopen the window, or quit.

## Start

Install Node.js 22.12 or newer and tmux. Run these commands from the repository root on macOS.

~~~sh
brew install tmux
cd playground/mediapipe_tmux_companion
npm ci
npm start
~~~

Set up the shared `test-model/models/gesture_recognizer.task` file once per checkout. It is the same model the Python baseline uses. The companion carries the MediaPipe JavaScript and WASM dependency and reads the model from that shared path. The app can launch for settings and tmux discovery before the model is installed. [Model download and settings](docs/MEDIAPIPE_RECOGNITION.md)

Start tmux from your normal terminal with **tmux new-session -s work** or attach to an existing session. If the companion is already open, click **Refresh sessions**. A single session is selected automatically. With multiple sessions, choose one in the dropdown. Detached sessions also appear. Once you have selected a session, the app keeps that choice until you change it or the session ends. If it ends, choose a session explicitly to resume gesture actions.

The app looks at the default local tmux server. For a named server, set its socket name when starting the companion. For an explicit socket path, use **TMUX_COMPANION_SOCKET_PATH** in place of the name variable.

~~~sh
TMUX_COMPANION_SOCKET_NAME=gesturemux-prototype npm start
~~~

## Set up a gesture

1. In **Gesture mappings**, pick a tmux command from the dropdown for the pose you want. Every row starts with **No command**. You can use the same command for multiple poses.
2. Fill in any fields the command shows. For example, **select-pane** cycles focus with no extra input and **rename-window** needs a new name. **move-pane** uses your active pane and asks where to move it. Select the next pane in the current window, or the active pane in the next or previous window.
3. Click **Check settings** to resolve the target without running the command. For a first test, split a disposable tmux window into two panes and map **Thumb up** to **select-pane**.
4. Click **Save mappings**. Turn the camera on from the window or menu bar. Focus your terminal, form the pose, then release it before repeating. Uncheck **Enabled** and save to pause a gesture while keeping its command.

**Advanced options** shows tmux's installed usage and accepts one argument per line. A command can require another pane, window, attached client, or interactive terminal. tmux can also reject a command after a successful check if the session changes. The MediaPipe log includes the failure reason. Explicit targets, server-wide commands, and commands that take nested commands can affect other sessions on the selected server.

**Allow closing and guarded commands** starts unchecked each launch. It stays checked until you clear it or quit. Guarded gestures require a continuous one-second hold after stabilization. Changing targets or disabling recognition cancels a pending hold. Direct **kill-pane** also protects the only pane in a window. Quit leaves the tmux server and its shells running.

The window shows the local preview, gesture, confidence, handedness and landmarks in the full result, inference timing, and the last action. Freeze output holds the displayed result. The log and inference continue. Camera capture stops when you turn it off, quit, lock the screen, or put the Mac to sleep. Turn it on again after unlocking or waking. If macOS blocks the camera, check **System Settings → Privacy & Security → Camera**.

## Verify

~~~sh
npm test
npm run test:tmux
npm run test:app
~~~

- **npm test** covers selection, persistence, command preparation, gesture stabilization, hold timing, and shared model routing.
- **npm run test:tmux** uses real disposable tmux servers to check discovery, target resolution, pane moves, error reporting, and close safeguards.
- **npm run test:app** needs the shared model file, a graphical macOS desktop, Python 3, and a real tmux binary. It checks Electron startup, IPC, settings, local MediaPipe inference with generated video, and background dispatch with a tmux client attached to a test PTY. It injects a synthetic pose label into one part of the test. A physical-camera and real-pose check is a separate manual step.
- Set **TMUX_TEST_BINARY** to the absolute path of a tmux executable to run the tests against that version. The default verification uses the installed system binary.

## Documentation

- [tmux integration](docs/TMUX_INTEGRATION.md)
- [MediaPipe model setup, inference, and tuning](docs/MEDIAPIPE_RECOGNITION.md)
- [Gesture mappings, advanced options, and safeguards](docs/GESTURE_MAPPINGS.md)
- [Development decisions](DECISIONS.md)
- [Implementation plan and verification history](IMPLEMENTATION_PLAN.md)
