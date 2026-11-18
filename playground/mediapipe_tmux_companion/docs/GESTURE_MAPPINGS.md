# Gesture mappings and command validation

The mapping panel renders one fixed row for each supported pose. Every row starts with **No command**. The first assignment enables the row. Disabling it keeps its command and options. Selecting **No command** clears the row. Multiple gestures can have the same command.

## Configure and verify

1. Start or attach to tmux in a regular terminal. Select the session in the companion.
2. Pick a command in the appropriate gesture row. Provide any field that appears.
3. Click **Check settings**. The companion resolves live targets and reports any missing prerequisite before execution.
4. Click **Save mappings**. Turn the camera on and perform the pose. Release it between actions. Only saved, enabled rows can trigger.
5. Check **Last action** or the recognition log for the outcome.

| Command | Guided behavior |
| --- | --- |
| `select-pane` | Cycles focus in the active window. The window needs a second pane. |
| `split-window` | Splits the active pane using tmux defaults. |
| `new-window` | Creates a window in the selected session. |
| `rename-window` | Targets the active window and asks for a new name. |
| `move-pane` and `join-pane` | Use the active source pane. Choose the next pane in the same window or the active pane in the next or previous window. |
| `kill-pane`, `kill-window`, and `kill-session` | Use the currently selected live pane, window, or session. Require the guard and a hold. `kill-pane` protects the last pane in a window. |

Bare `move-pane` can resolve source and target to the same pane. Guided mode supplies explicit `-s` and `-t` and checks for distinct pane IDs. **Check settings** runs read-only target resolution. A successful check describes current conditions, which can change before dispatch. [tmux command preparation](TMUX_INTEGRATION.md#command-dispatch)

## Advanced options and guard

Turn on **Use advanced arguments** under **Advanced options**. Enter one literal argument per line. Spaces within one line stay in the same argument, and blank lines are ignored. The row shows usage obtained from the installed tmux server. Explicit overrides may affect another session. Server-wide and nested commands can affect more than one session.

**Allow closing and guarded commands** starts unchecked and stays checked until you clear it or quit. Reviewed guided commands can fire after stabilization. Other commands, including pane moves, direct close commands, and Advanced mode, require a one-second hold after stabilization. Changing the target, camera state, saved mapping, or guard cancels pending attempts. Guarded pane moves pin their source and destination. Keyboard bindings stay under tmux’s control.

## Persistence and dispatch payload

Electron stores `gesture-mappings.v1.json` in its `userData` directory. The JSON root is `{ version: 1, gestures: { ... } }` with one key for each saved pose. A guided next-window move row looks like this:

~~~json
{
  "enabled": true,
  "binding": {
    "command": "move-pane",
    "mode": "guided",
    "options": { "destination": "next-window" },
    "args": []
  }
}
~~~

[Config validation](../shared/config.js) checks the fixed roster and binding structure. Commands accept up to 32 advanced arguments of up to 512 characters each. [Command validation](../shared/commands.js) checks required options. [Settings storage](../electron/settings.cjs) serializes saves and atomically replaces the file. A successful save publishes a new revision, and a failed save retains the last active revision. A command removed from the catalog can remain in the saved file, but dispatch needs the active server to advertise it.

The renderer sends the gesture label, saved revision, selected target token, camera generation, and optional hold phase and ID. Main uses the saved row and validates the request again before constructing argv.
