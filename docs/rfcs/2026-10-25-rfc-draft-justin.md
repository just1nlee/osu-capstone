<!-- docs/rfcs/2026-10-25-rfc-draft.md -->

# RFC-001: Electron vs CLI native vs Hybrid for Multiplexer Architecture

Project 60: Vision-Based Gesture Control for Terminal Multiplexers

Justin Lee <leeju8@oregonstate.edu>

<!-- Decision record header. Leave Status as "Proposed" until your team decides,
     before or after the reviews. Then fill in the outcome and the decision date.
     The document stays where it is; this header is what makes it a record. -->

| Field         | Value                                                   |
| ------------- | ------------------------------------------------------- |
| Author        | Justin Lee                                              |
| Date          | 2026-10-25                                              |
| Status        | Proposed                                                |
| Decision Date | (fill when decided)                                     |
| Deciders      | Farzaan Wadiwalla, Havel Konda, Justin Lee, Tobias Kohn |
| Superseded By | (link, if applicable)                                   |

## Problem and Context

Our capstone, "Vision-Based Gesture Control for Terminal Multiplexers," has two halves: a Python gesture recognizer (MediaPipe Hands) that turns camera hand poses into commands such as focus, split, close, and resize, and a terminal multiplexer that receives these commands and executes them. This RFC decides what the multiplexer is: a desktop GUI built on a web runtime (Electron), a native program running inside the user's existing terminal emulator, or a hybrid of the native program plus an optional Electron companion app.

This decision is hard to reverse because it fixes which code owns terminal state. Terminal state is the grid of characters and colors each pane shows, built by interpreting the escape codes that programs like vim send to draw on screen. In the web-runtime option, xterm.js owns that state in JavaScript. In the native option, C code owns it through a VT emulation library such as libvterm, and the user’s own terminal only displays the result. The hybrid approach keeps the native program’s ownership: libvterm owns each pane’s state, and the C multiplexer composites all panes into a single screen. xterm.js only displays that composited screen as one of many host terminals the multiplexer can run in. Switching later would mean rewriting the PTY handling (the pseudo-terminal connection between the multiplexer and each shell), the compositing and rendering code, and the tests built on both.

If we do nothing, the core infrastructure of the multiplexer goes undecided and progress on the project will stall. The decision is needed now because the multiplexer core starts in Sprint 2 (weeks 5-6), and the multiplexer's language, the command bus protocol, gesture feedback, and rendering tests all follow from it.

## Options

### Option A: Web-Runtime GUI (Electron)

One Electron window containing an xterm.js instance per pane, with PTYs from node-pty. Electron handles layout, and gesture commands arrive over IPC.

- **Benefits:** xterm.js is a mature emulator (it powers VS Code's integrated terminal), so we borrow VT correctness instead of building it. Gesture feedback can use pixels: highlights, animated layout changes, and the debug view in the same window. This is the fastest path to a working demo.
- **Costs:** the multiplexer only exists inside our app, so users cannot run it in the terminal they already use. Electron bundles Chromium and Node, so the install size and memory baseline are large. Running PTYs next to a web renderer means following Electron's security checklist (context isolation, no Node integration in renderers).
- **Right choice when:** polished visual feedback is the center of our evaluation, and speed to a demo matters more than the multiplexer working outside our app.

### Option B: Native Program

A standalone C multiplexer that runs inside any terminal emulator, the same model as tmux. It spawns a PTY per pane, interprets each pane with libvterm, composites the panes into one screen, and receives gesture commands over a local socket. The debug view is a separate web page served by the recognizer.

- **Benefits:** works in the user's own terminal with their own fonts and settings, has a small footprint, and has no web runtime on the gesture-to-pane path.
- **Costs:** we own VT emulation integration, compositing, and redraw performance. Gesture feedback is limited to character cells (border colors, reverse video, a status line). A program inside a terminal cannot register a system-wide hotkey, so turning on the camera or opening the debug view takes manual steps.
- **Right choice when:** users already live in their terminal and the project should stay a single program with minimal scope.

### Option C: Hybrid (Native Program Plus Companion App)

The same C multiplexer as Option B, plus an Electron companion app. The app registers a global hotkey (Option+Space, configurable) that summons the debug dashboard and turns on the camera, and it includes an xterm.js terminal that serves as a known-good host for the multiplexer. The multiplexer still runs in any terminal; the app is optional.

- **Benefits:** everything in Option B, plus one-keystroke access through Electron's globalShortcut API, the debug view (camera feed, current command, confidence) in one place, and consistent rendering for demos and testing.
- **Costs:** two programs to build and maintain. Inside the bundled terminal, output is interpreted twice (libvterm for each pane, then xterm.js for the composited screen), which adds a hop to gesture latency.
- **Right choice when:** one-keystroke activation and the integrated debug view are part of the user experience we are evaluating, not just conveniences.

### Option D: Do Nothing (Defer the Decision)

Spend Sprint 2 on the gesture recognizer and decide on the multiplexer once recognition accuracy is known.

- **Benefits:** no architecture work is spent on a multiplexer that might matter less than expected if recognition proves unreliable.
- **Costs:** the multiplexer core slips out of Sprint 2, so Sprint 3's gesture integration has nothing to integrate with. The command bus protocol stays undefined, so the recognizer team builds against a guess. CI has no target to test.
- **Right choice when:** recognizer feasibility is so uncertain that the multiplexer's design may not matter at all.

## Analysis

**Complexity.** A borrows VT emulation from xterm.js, which powers VS Code's integrated terminal [1]. B and C borrow it from libvterm, which Neovim uses for its built-in terminal [2], so parsing is well tested, but compositing and redraw are ours to build. tmux shows this model works at scale [3]. C adds a second program, but its only jobs are a global hotkey [4], the dashboard, and hosting a terminal.

**Maintainability.** In B and C the multiplexer does not depend on any front end, so the companion app can change or be dropped without touching the core. In A, layout, PTYs, and rendering all live in one Electron codebase.

**Cost.** Every dependency is free and open source. The real cost is team time: A is cheapest now, and C costs the most up front.

**Uncertainties.** We do not know whether our compositor redraws fast enough with several busy panes, or whether cell-based feedback is clear enough for gesture users.

## Recommendation and Verification Plan

I propose Option C. It keeps the multiplexer independent of any front end, as in Option B, so it runs in any terminal and can be tested without a screen. The companion app adds the one capability a terminal program cannot have: a system-wide hotkey that summons the dashboard and turns on the camera. Because the app is optional, the hard-to-reverse part of this decision is limited to the multiplexer's state model and command protocol.

We will know it worked through these checks:

1. **Headless command tests (every PR, in CI).** A harness replays recorded gesture commands against the multiplexer and compares the resulting layout to expected output. If this needs a real terminal attached, the core is coupled to its front end.
2. **Runs anywhere (each release).** The multiplexer works with no companion app in at least two other terminal emulators. Programs like vim and btop should render without corruption in a multiplexed terminal pane.
3. **Companion app (end of Sprint 4).** The hotkey summons the dashboard and turns on the camera, and closing the app leaves the multiplexer running.
4. **Fallback trigger.** If check 3 still fails at the start of winter term, we drop the companion app and continue as Option B.

## Constraints

**Licensing.** Every dependency under consideration is permissively licensed: libvterm, xterm.js, Electron, and node-pty (MIT), and MediaPipe (Apache-2.0). No option restricts how we license our public repository.

**Data use.** Camera frames are processed locally and never stored or sent over the network. The multiplexer receives commands, not images. In Option C, the companion app shows the camera feed only in debug mode, over a localhost connection. Terminal contents can include secrets, so the multiplexer's socket is readable only by the user.

**Partner confidentiality.** None applies. The project is student-proposed with no external partner or NDA.

## Delegation and Validation

- **What I handed to AI tools:** I used Claude to draft the Problem and Context, Options, Analysis, Recommendation, and Constraints sections from my design decisions and to review my drafts.

- **What checks made that reasonable:** The repository has branch protection and required reviews, so no change reaches main without a teammate's approval. No CI or automated tests exist yet; the checks in the verification plan are proposed, not implemented.

- **Where I validated the result myself:** I defined the hybrid architecture, including the companion app's role and the requirement that the multiplexer run in any terminal, because that boundary is the hard-to-reverse part of this decision. I personally wanted the multiplexer to run as a separate program but also wanted features such as a desktop keybind summon and a debugging interface, so I confirmed that the Electron companion application is feasible by running tmux inside VSCode's xterm.js terminal and checking that an Electron application can register a global hotkey in Electron’s globalShortcut documentation [4].

## Decision

Proposed. To be decided by team majority vote.

## References

1. xterm.js. https://xtermjs.org/
2. Neovim terminal documentation. https://neovim.io/doc/user/terminal.html
3. tmux(1) manual. https://man7.org/linux/man-pages/man1/tmux.1.html
4. Electron globalShortcut API. https://www.electronjs.org/docs/latest/api/global-shortcut
