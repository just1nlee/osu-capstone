# tmux integration

The terminal emulator owns the interactive tmux client. tmux owns the server, windows, panes, shells, and keyboard bindings. The companion sends one-shot requests to the installed tmux CLI.

~~~text
Terminal emulator ↔ interactive tmux client ↔ local tmux server
                                                   ↑
Webcam → renderer → gesture gate → Electron IPC → main → execFile(tmux, argv)
~~~

## Discovery and selection

[Main](../electron/main.cjs) owns discovery, selection, the command catalog, camera eligibility, and IPC. The [tmux adapter](../electron/tmux.cjs) tries `tmux` on `PATH`, `/opt/homebrew/bin/tmux`, and `/usr/local/bin/tmux`. It uses the default socket unless one of the following launch variables is set. Set only one and point your terminal at the same server.

| Variable | Example | tmux option |
| --- | --- | --- |
| `TMUX_COMPANION_SOCKET_NAME` | `gesture-demo` | `-L gesture-demo` |
| `TMUX_COMPANION_SOCKET_PATH` | `/tmp/example-tmux.sock` | `-S /tmp/example-tmux.sock` |

The adapter clears inherited `TMUX` and `TMUX_PANE` and preserves `TMUX_TMPDIR`. It uses `-N` to prevent requests such as `list-commands` from starting a server, and `-u` to preserve UTF-8 labels and delimiters. [tmux manual](https://man.openbsd.org/tmux)

`list-sessions -F` returns session ID, server PID, server start time, session creation time, attached-client count, and display name. The socket and server fields identify a server instance. Session ID and creation time identify a session within it. [Selection state](../electron/session-selection.cjs)

| Discovery result | Companion behavior |
| --- | --- |
| No session | Shows an empty state. **Refresh sessions** supports starting tmux later. |
| One initial session | Selects it automatically. |
| Multiple initial sessions | Waits for a dropdown choice. |
| A valid selection is renamed or another session appears | Retains the existing selection. |
| The selected session disappears or the server restarts | Clears the target, cancels a pending hold, and requires a new explicit choice. |

The companion refreshes the selected session every three seconds. Attached and detached sessions both appear in the picker. Closing the terminal can leave a detached session alive, so ordinary gesture commands remain eligible. Ending the session makes its identity invalid. Quitting the companion leaves tmux running.

## Command dispatch

1. Read supported command names and usage with `list-commands -F`. The catalog belongs to the installed server version.
2. Verify the selected session identity and get its window and pane layout with scoped `list-windows` and `list-panes`. Query `list-clients` for commands that need a client. Where an implicit client is required, exactly one eligible client must be available.
3. Prepare argv with [the command adapter](../shared/commands.js). Resolve IDs such as `$0`, `@1`, and `%2` against live state. Guided commands have contextual defaults and explicit advanced options can override targets. **Check settings** uses the same preparation path without running the command.
4. [Dispatch](../electron/dispatch.cjs) rechecks the saved mapping revision, target token, camera generation, and guard after asynchronous lookups. Main runs one action at a time. Guarded actions use `begin`, `commit`, and `cancel` with an attempt ID and pinned targets.
5. Invoke `execFile(binary, argv)`. Each call has a 750 ms timeout and a 64 KiB output limit. The adapter encodes a final semicolon for tmux’s own argv parser. The log shows the outcome and bounded, sanitized tmux errors. A timeout leaves the outcome uncertain and triggers no automatic retry.

The [preload bridge](../electron/preload.cjs) exposes fixed methods under `window.gestureCompanion`. The renderer supplies a gesture label and state tokens. Main resolves the saved command and builds argv. Application data stays on the local machine. The UI has no terminal stream and does not display action stdout.

Direct pane, window, and session closes use the selected target and a tmux-side recheck. `kill-pane` protects the only pane in a window. Explicit target overrides, server-wide commands, linked windows, and commands that accept nested commands can have effects beyond the selected session. Commands such as `attach-session` need an interactive terminal.

## Troubleshooting

- For a missing session, run `tmux list-sessions` or use the same socket argument as the companion. Refresh after starting tmux.
- For a missing command, refresh the catalog and check the server version.
- For a missing or ambiguous client, attach a client to the selected session or specify the one you intend in Advanced options.
- For a rejected gesture, inspect **Last action** and the recognition log for the target, guard, or tmux error. [Gesture mappings](GESTURE_MAPPINGS.md)
