# Vision-Based Gesture Control for Terminal Multiplexers

A camera watches your hands. A recognizer turns hand poses into semantic commands and sends them to a terminal multiplexer, which rearranges its panes in response.

Project 60, CS 461/462, Oregon State University, 2026 to 2027. Mentor: Prof. Alexander Guyer, EECS. This is a student-proposed project with no external partner and no NDA.

## Status

**The product stack is not settled.** Candidate architectures are being compared in the RFCs and will be decided by team vote and recorded as an ADR. The Electron/MediaPipe experiment under `playground/mediapipe-example` is a runnable checkpoint scaffold, not the terminal multiplexer or a stack decision.

## Checkpoint scaffold quickstart

Install Node.js 22 or later and npm, then run:

```sh
git clone https://github.com/just1nlee/osu-capstone.git
cd osu-capstone
cd playground/mediapipe-example
npm ci
npm start
```

The scaffold is a source-run desktop app with no separate compilation or packaging step. It demonstrates color controls and optional camera-based gesture recognition; see its [README](playground/mediapipe-example/README.md). A graphical desktop is needed to launch it. The MediaPipe model downloads when gesture control is enabled.

Run the camera-free scaffold checks with:

```sh
npm test
```

The [scaffold CI workflow](.github/workflows/ci.yml) is configured to run on every pull request and on pushes to any branch. On a macOS runner it installs the locked dependencies with `npm ci`, launches the Electron app, and runs two camera-free tests: keyboard navigation wraps without applying a color, and clicking a color selects and applies it. The app runs from source; CI does not produce a packaged build. These checks exercise the scaffold, not the planned multiplexer or live webcam recognition.

**Checkpoint evidence still needed:** the team must agree whether this experiment is an appropriate scaffold and whether its source-run check satisfies the build requirement. Push the commit selected for submission, confirm its CI run passes, and link that run on the PDF cover. A temporary broken-navigation check has failed locally, but a failing GitHub Actions run has not yet been demonstrated.

## What it does

Gestures control navigation and layout only:

- Spawn a pane
- Focus a pane
- Rearrange the layout

The keyboard does all actual work. Gestures are not used for scrollback search, copy mode, or text editing.

Out of scope this year: wearable and EMG hardware, and an agent-driven command path.

## Roadmap

| Phase | Complete before | Goal |
| ----- | --------------- | ---- |
| 1     | 11/22           | Define the input schema and build a webcam-based recognizer using MediaPipe's built-in gestures |
| 2     | 1/16            | Integrate the recognizer into the multiplexer and map recognition output to terminal commands |
| 3     | 2/14            | Expand the Phase 2 demo, harden edge cases, and measure performance |
| 4     | Stretch goal    | Glasses-mounted camera |

**Phase 1 (before 11/22)**

- Identify the input schema, for example thumbs up maps to "open panel".
- Build a webcam-based gesture recognizer on MediaPipe's built-in gestures. We remap those gestures to commands rather than training a custom classifier.

**Phase 2 (before 1/16)**

- Integrate the recognizer into the multiplexer application.
- Map the model's recognition output to a terminal command.
- Add integration tests.

The intended flow: thumbs up, the model detects the gesture, it outputs the mapping "open panel", which becomes a command (for example Cmd+P), and the action occurs.

**Phase 3 (before 2/14)**

- Expand the Phase 2 demo with more commands.
- Handle edge cases and difficult decisions.
- Measure accuracy, latency, false positives, and similar metrics.

**Phase 4 (stretch goal)**

- Glasses-mounted camera. Wearable hardware is out of scope this year (see above), so this is only pursued if the team and mentor agree to bring it in scope.

Any recorded test data must contain derived hand-landmark coordinates only, never raw frames or recognizable video.

## Privacy

Camera input is processed locally. Raw camera frames are never saved, transmitted, or committed. Only derived coordinate output may be shared or committed. See the confidentiality boundary in [`AGENTS.md`](AGENTS.md).

## Documentation

| Document                                       | What it covers                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [`docs/requirements.md`](docs/requirements.md) | Product goal, functional and quality requirements, MVP acceptance criteria                                             |
| [`docs/design.md`](docs/design.md)             | Proposed architecture, intent interface, gesture event handling, testing boundaries                                    |
| [`docs/rfcs/`](docs/rfcs/)                     | Proposed decisions: multiplexer architecture, custom gestures and keybindings, gesture event state machine, input method |
| [`docs/team-charter.md`](docs/team-charter.md) | Team members                                                                                                           |
| [`docs/assignments/`](docs/assignments/)       | Course workshops and sprint notes                                                                                      |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)          | Workflow, Definition of Done, review rules                                                                             |
| [`AGENTS.md`](AGENTS.md)                       | Conventions and constraints for AI coding tools                                                                        |

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first. In short:

- Trunk-based development. `main` is protected; open a pull request and squash merge after one approving review.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- Architecture, scope, and stack decisions need a team vote and an ADR in `docs/adr/`.
- Never commit secrets, `.env`, or camera footage.

## Team

- Farzaan Wadiwalla
- Havel Konda
- Justin Lee
- Tobias Kohn
