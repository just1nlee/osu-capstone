# RFC-001: Electron vs CLI Native vs Hybrid for Multiplexer Architecture

Project 60: Vision-Based Gesture Control for Terminal Multiplexers

Justin Lee <leeju8@oregonstate.edu>

| Field         | Value                                                   |
| ------------- | ------------------------------------------------------- |
| Author        | Justin Lee                                              |
| Date          | 2026-10-25 (revised 2026-11-22)                         |
| Status        | Accepted                                                |
| Decision Date | 2026-10-28                                              |
| Deciders      | Farzaan Wadiwalla, Havel Konda, Justin Lee, Tobias Kohn |
| Superseded By | None                                                    |

## Problem and Context

Our capstone lets a developer rearrange terminal workspaces with hand gestures in front of a laptop camera. A terminal multiplexer is a program that lets one terminal window hold several shells at once. It divides the window into rectangular panes, each running its own shell, and lets the user create, close, resize, and move between them. tmux is the best-known example; it drives those actions with a prefix key followed by a command key [3]. Our project serves developers who keep many panes open (an editor, a build, logs, a coding agent) and reorganize them often. Gestures handle layout only; the keyboard still does the work inside each pane.

The system has two halves: a Python gesture recognizer (MediaPipe Hands) that turns camera hand poses into commands such as focus, split, close, and resize, and a multiplexer that executes them. This RFC decides what the multiplexer is: an Electron desktop GUI, a native program inside the user's existing terminal, or a hybrid of the two.

This decision is hard to reverse because it fixes which code owns terminal state. Terminal state is the grid of characters and colors each pane shows. In the Electron option, xterm.js owns that state in JavaScript. In the native option, C code owns it through an in-memory VT emulator, and the user's terminal only displays the composited result. The hybrid keeps native ownership; xterm.js only displays the composited screen, as one of many possible host terminals. Switching later means rewriting the PTY handling (the pseudo-terminal connection to each shell), the compositing and rendering code, and the tests built on both.

The decision was needed before Sprint 2 (weeks 5 and 6), when the multiplexer core started ([project issues](https://github.com/just1nlee/osu-capstone/issues)). The language, command protocol, feedback, and rendering tests all follow from it. Doing nothing would have left the recognizer building against a guessed protocol and Sprint 3's integration with nothing to integrate.

## Options

### Option A: Web-Runtime GUI (Electron)

One Electron window contains an xterm.js instance per pane, with PTYs from node-pty. Electron handles layout, and gesture commands arrive over IPC.

xterm.js is a mature emulator that powers VS Code's integrated terminal [1], so this option borrows VT correctness instead of building it. Gesture feedback can use pixels: highlighted borders, animated layout changes, and the debug view in one window. We estimate a working core within one sprint.

The costs are reach, weight, and security work. The multiplexer only exists inside our app, so developers cannot use it in the terminal they already configured, and those are the developers we serve. Electron embeds Chromium and Node.js in every app [5], so install size and idle memory are a browser's. Running PTYs next to a web renderer means following Electron's security checklist, such as context isolation [6]. It is the right choice when polished visual feedback is the center of our evaluation and speed to a demo matters more than running outside our app.

### Option B: Native Program

A standalone C multiplexer runs inside any terminal emulator, the same model as tmux. It spawns a PTY per pane, interprets each pane with an in-memory VT emulator (our own, or a library such as libvterm, which Neovim uses for its built-in terminal [2]), composites the panes into one screen, and receives gesture commands over a local socket. The debug view is a separate web page served by the recognizer.

It works in the user's own terminal with their fonts and settings, has a small footprint, and has no web runtime between a gesture and its pane.

The costs are build time and feedback quality. We own emulator integration, compositing, and redraw performance, which we estimate spans Sprints 2 through 4. Gesture feedback is limited to character cells: border colors, reverse video, and a status line. That matters because our gestures execute immediately, with no confirm step, so the user must see which pane a gesture targets while the hand is still moving. A program inside a terminal also cannot register a system-wide hotkey, so turning on the camera or opening the debug view takes manual steps every session. It is the right choice when users already live in their terminal and the project should stay one program with minimal scope.

### Option C: Hybrid (Native Program Plus Companion App)

Option B's multiplexer plus an Electron companion app. The app registers a global hotkey (Option+Space, configurable) that summons the debug dashboard and turns on the camera, and it includes an xterm.js terminal as a known-good host for the multiplexer. The multiplexer still runs in any terminal; the app is optional.

It keeps Option B's benefits and adds one-keystroke access through Electron's globalShortcut API [4], the debug view (camera feed, current command, confidence) in one place, and consistent rendering for demos and testing.

The costs are two programs. The companion app adds roughly one sprint on top of Option B, scheduled for winter term after the walking skeleton ([docs/design.md](https://github.com/just1nlee/osu-capstone/blob/main/docs/design.md)), and every protocol change touches both. The app inherits Option A's security checklist [6] and weight, though only users who choose it pay that cost. Inside the bundled terminal, output is interpreted twice (C emulator, then xterm.js), adding a hop to gesture latency. Which process owns turning recognition on and off is decided separately in ADR-0002 (proposed); this option assumes only that the hotkey can trigger it. It is the right choice when one-keystroke activation and the integrated debug view are part of the experience we are evaluating, not just conveniences.

### Option D: Do Nothing (Defer the Decision)

Spend Sprint 2 on the recognizer and decide on the multiplexer once recognition accuracy is known. No architecture work is spent on a multiplexer that might matter less if recognition proves unreliable.

The cost is the schedule: the multiplexer core slips out of Sprint 2, Sprint 3's integration has nothing to integrate with, the recognizer is built against a guessed protocol, and CI has no target. It is the right choice when recognizer feasibility is so uncertain that the multiplexer's design may not matter at all.

## Analysis

**Performance.** Option C's double interpretation is the same arrangement as running tmux inside any terminal: tmux interprets each pane, then the outer terminal interprets tmux's composited output [3]. VS Code's integrated terminal is xterm.js [1], so running tmux there is exactly this arrangement. Option A avoids the hop but pays Chromium's baseline cost [5]; Option B has the shortest path.

**Complexity.** Option A borrows VT emulation from xterm.js [1]. Options B and C need a C emulator; Neovim's use of libvterm [2] and tmux [3] show the model works. Our C prototype so far is a PTY passthrough ([commit 4bf2a90](https://github.com/just1nlee/osu-capstone/commit/4bf2a90d698f80423c96bcd669a6d82cabf7e334)): it proves the fork, raw-mode, and byte-copying path, but the outer terminal still renders everything. The VT state layer, compositing, and redraw are not built yet. Option C's second program only handles a hotkey [4], the dashboard, and a host terminal.

**Maintainability and testability.** In B and C the multiplexer does not depend on any front end, so the companion app can change or be dropped without touching the core. Once the emulator holds screen state in memory, the core can be tested by feeding it bytes and commands and comparing the resulting screen, with no window involved. In Option A, testing layout means driving a renderer.

**Security.** Terminal output is untrusted input. Electron's checklist [6] covers all of Option A but only Option C's optional app. In B and C the command socket is the other exposure: any process that can write to it can close panes, so it must be restricted to the user.

**Cost.** Every dependency is free; the real cost is team time: about one sprint for A's core, Sprints 2 through 4 for B, and B plus about one more sprint for C.

**Uncertainties.** We have not measured whether our compositor redraws fast enough with several busy panes, how much latency the xterm.js hop adds in practice, or whether cell-based feedback in a native terminal is clear enough for gesture users. Check 3 below is designed to answer the first two; the third is left to user testing.

## Recommendation and Verification Plan

I recommend Option C. It keeps the multiplexer independent of any front end, so it runs in any terminal and, once the emulator holds state, can be tested without a screen, and the companion app adds the system-wide hotkey a terminal program cannot have. Because the app is optional, the hard-to-reverse part is limited to the state model and command protocol.

**Check 1: headless command tests (every PR, once the multiplexer has a CI target).** A harness replays recorded command logs (not camera frames) against the multiplexer and its in-memory emulator and compares the resulting layout and screen to stored expected output. Needing a terminal attached is itself a failure: it means the core is coupled to a front end. CI ([.github/workflows/ci.yml](https://github.com/just1nlee/osu-capstone/blob/main/.github/workflows/ci.yml)) runs on every push and PR but covers only the recognizer scaffold, so this harness is planned, not implemented.

**Check 2: supported terminals (each release).** The multiplexer runs with no companion app in Terminal.app, iTerm2, and Ghostty, plus the companion app's xterm.js terminal. The tester opens four panes, runs vim and btop, resizes the window, and quits vim. It fails if any pane shows leftover characters, the layout does not reflow on resize, or the screen is not restored after vim exits. Emulators not on this list are unsupported until added.

**Check 3: latency budget (each release).** The multiplexer logs wall-clock timestamps when a command arrives on its socket and when the resulting frame is written to the host terminal. With four panes, one printing continuous output, the 95th percentile must stay at or under 50 ms in every supported terminal, leaving the rest of a 100 ms budget, the limit at which a response feels instantaneous [14], to the recognizer. Native terminals expose no paint event, so this limit covers socket to write only. In the companion app, xterm.js's render event logs a third timestamp on the same clock, and write-to-paint is reported separately as the xterm.js hop; if it pushes the app past 100 ms, we stop demoing in its terminal.

**Check 4: companion app (by the end of winter week 6).** The hotkey summons the dashboard and turns on the camera, the camera prompt names the companion app, and closing the app leaves the multiplexer running and answering its socket. An ad-hoc signature changes with each build, so macOS may re-prompt after a rebuild; the tester runs this on a fresh build.

**Check 5: privacy (every PR, once the multiplexer has a CI target).** A test asserts the command socket is created with owner-only permissions. A recognizer run on a recorded fixture writes no image files, and the dashboard's camera feed listens on 127.0.0.1 only.

**Fallback.** If check 4 still fails at the end of winter week 6, the team votes at the next mentor meeting on dropping the companion app and continuing as Option B. The debug view would move to a web page served by the recognizer, and users would start the recognizer from their own terminal. The multiplexer and protocol would not change, which check 1 confirms, and this RFC would be marked superseded.

## Constraints

**Licensing.** Our direct dependencies are permissive: xterm.js, Electron, node-pty, and libvterm (MIT) and MediaPipe (Apache-2.0), so no option restricts how we license our repository. Both licenses condition redistribution: MIT requires its copyright notice in copies [12], and Apache-2.0 requires a copy of the license and any NOTICE file [13]. Electron also bundles Chromium, whose mixed licenses are listed in the LICENSES.chromium.html file Electron ships. So any companion app build we hand out ships that file plus our own third-party notices, and each release checks both are present and every bundled dependency is listed.

**Data use.** Camera frames are processed locally, never stored or sent over the network, and the multiplexer receives commands, not images. The camera feed appears only in the dashboard's debug mode, over localhost. Fixtures in our public repository are command logs, never camera frames. Terminal contents can include secrets, so the socket is accessible only by the user. Check 5 enforces each of these.

**macOS camera permission.** The project targets macOS only. macOS grants camera access to the process it treats as responsible: a tool run from Terminal is attributed to Terminal, and a helper spawned by an app is attributed to that app [7][8]. In Option C, a recognizer launched by the companion app is therefore attributed to the Electron app, which must declare a camera usage description and be validly signed, or macOS may not show the prompt at all, as another desktop app with an integrated terminal found [9]. This is a condition on the recommendation and the reason check 4 verifies which app the prompt names.

**macOS distribution.** Apps distributed outside the Mac App Store must be signed with a Developer ID certificate and notarized to run under default Gatekeeper settings [11], which requires a paid Apple Developer Program membership [10]. For the capstone the companion app is built locally and ad-hoc signed, which is the configuration check 4 verifies; Developer ID releases are deferred until the team decides the cost is worth it.

**Partner confidentiality.** None applies. The project is student-proposed with no external partner or NDA.

## Delegation and Validation

For the draft, I used Claude to write the first five sections from my design decisions and to review my drafts. For this revision, I used Claude to turn the reviews into a list of changes, draft the revised sections, and research the macOS and license constraints.

The repository has branch protection and required reviews, so no change, including this RFC, reaches main without a teammate's approval. CI runs on every push and PR but only against the recognizer scaffold, so the multiplexer checks in the verification plan are planned, and review is the only gate on multiplexer code today. Claude's drafting changed how the decision is explained and verified, not the decision.

I validated three points myself. First, I defined the hybrid architecture, including the companion app's role and the requirement that the multiplexer run in any terminal, because that boundary is the hard-to-reverse part of this decision. I checked the hotkey's feasibility against Electron's globalShortcut documentation [4]. Second, I wrote the PTY passthrough prototype (commit 4bf2a90) myself, because PTY handling is one of the parts this decision makes expensive to rewrite, and a mistake in raw mode or process setup would corrupt every pane. Third, I read each new source behind the Constraints section [7]–[13] before keeping its claim, because a wrong assumption about camera permission would break check 4 and the camera path it protects.

## Decision

Accepted by team majority vote on 2026-10-28: Option C, the hybrid. The companion app uses Electron. Recorded in [ADR-0001](https://github.com/just1nlee/osu-capstone/blob/main/docs/adr/0001-hybrid-multiplexer-architecture.md).

## References

1. xterm.js. https://xtermjs.org/
2. Neovim terminal documentation. https://neovim.io/doc/user/terminal.html
3. tmux(1) manual. https://man7.org/linux/man-pages/man1/tmux.1.html
4. Electron globalShortcut API. https://www.electronjs.org/docs/latest/api/global-shortcut
5. Electron documentation, introduction. https://www.electronjs.org/docs/latest/
6. Electron security checklist. https://www.electronjs.org/docs/latest/tutorial/security
7. Apple Developer Forums, "How to grant command line tools full disk access" (Apple DTS reply on TCC responsible code). https://developer.apple.com/forums/thread/756510
8. "The curious case of the responsible process," Qt Blog. https://www.qt.io/blog/the-curious-case-of-the-responsible-process
9. T3 Code issue #728, camera and microphone prompts not shown from the integrated terminal on macOS. https://github.com/pingdotgg/t3code/issues/728
10. Apple, Developer ID. https://developer.apple.com/support/developer-id/
11. Apple Platform Security, "App code signing process in macOS." https://support.apple.com/guide/security/sec3ad8e6e53/web
12. The MIT License. https://opensource.org/license/mit
13. Apache License, Version 2.0. https://www.apache.org/licenses/LICENSE-2.0
14. J. Nielsen, "Response Times: The 3 Important Limits," Nielsen Norman Group. https://www.nngroup.com/articles/response-times-3-important-limits/
