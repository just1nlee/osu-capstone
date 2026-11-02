# System Design

## Architecture

The following describes a proposed product architecture, not an implemented system or a final stack decision. The current runnable scaffold is described below.

The proposed application uses a command bus:

```text
Gesture recognizer ─┐
MCP server ─────────┼─> Command bus ─> Layout engine ─> Terminal renderer
Keyboard bindings ──┘
```

Input sources produce semantic intents. The layout engine does not need to
know which source produced an intent.

Planned components:

- **Gesture recognizer:** Python and MediaPipe; reads camera input and applies
  confidence and gesture-event rules.
- **Command bus:** JSON messages over WebSocket.
- **Multiplexer core:** Go; validates intents and owns pane/layout state.
- **Terminal renderer:** Electron with xterm.js.
- **MCP server:** Produces the same intents as gestures and keybindings.

## Interfaces

The recognizer and multiplexer run as separate processes. A versioned intent
contains a command and any command-specific data:

```json
{
  "version": 1,
  "command": "focus_next"
}
```

Example commands include:

- `create_pane`
- `focus_next`
- `focus_previous`
- `set_layout`
- `launch_agent`

The receiver must reject unknown commands, missing fields, invalid values, and
unsupported versions without changing the layout. Recognition confidence is
used by the recognizer before an intent is sent.

## Gesture event handling

The recognizer processes continuous model results through a state machine.
It requires a deliberate, sufficiently confident gesture, emits at most one
intent while that gesture is held, and waits for release before allowing it to
trigger again. Low-confidence results and lost tracking produce no intent.

## Data model

The multiplexer owns:

- Panes and their identifiers
- The focused pane
- Pane relationships and dimensions
- The active layout

The command bus transports intents; it does not own terminal state. Camera
frames are transient and are not stored.

## Deployment

Normal use is local:

- Start the Go multiplexer and Electron renderer.
- Start the Python recognizer with access to the local camera.
- Connect the recognizer to the multiplexer over the local WebSocket.

The product does not require a cloud runtime. GitHub Actions may run tests,
linting, security checks, and packaging checks, but camera data and terminal
state remain on the user's computer.

## Current checkpoint scaffold

The separate `playground/mediapipe-example` Electron/MediaPipe experiment demonstrates gesture recognition and color selection. It is not the multiplexer described above and does not settle the production stack. CI checks this scaffold as described in the root README.

## Testing boundaries

- Unit-test mapping, state-machine transitions, intent validation, and layout
  operations without a camera.
- Integration-test WebSocket messages and layout changes with synthetic intents.
- Manually test camera recognition, visual feedback, and the complete gesture
  to pane-control flow.