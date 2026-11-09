# Sprint Note: Sprint 2, Project 60: Vision-Based Gesture Control for Terminal Multiplexers

<!-- One page maximum. Each numbered section is graded pass/fail (20 points each).
     The evidence may be AI-generated from your repo history and board.
     Two things must be human-written: section 5, and the "shipped" sentence
     in each contribution line. Those are the parts anyone reads. -->

**Team:** Project 60: Vision-Based Gesture Control for Terminal Multiplexers
**Sprint dates:** 10/26/2026 to 11/8/2026
**Date submitted:** 10/8/2026

## 1. Working Software Evidence

- **CI Run/MediaPipe Model Experimentation Demo:** https://youtu.be/oGMsVzWTuQA
- **Nested Terminal Emulator Program Demo:** https://youtu.be/tlJ82i0Epy0

## 2. What Got Done, and Who

- **Where the work is tracked:** https://github.com/just1nlee/osu-capstone/issues?q=is%3Aissue
- **Done this sprint:**
  - Created an Electron-based MediaPipe gesture-control prototype ([PR #25](https://github.com/just1nlee/osu-capstone/pull/25)), resolving GitHub Issue: test/experiement-with-baseline-mediapipe-model([Issue #17](https://github.com/just1nlee/osu-capstone/issues/17))
    - Set up a GitHub Actions workflow that tests the behavior of the prototype application
  - Created a working nested terminal emulator program ([PR #28](https://github.com/just1nlee/osu-capstone/pull/28)), resolving GitHub Issue: feat/single-pane-terminal-emulator ([Issue #13](https://github.com/just1nlee/osu-capstone/issues/13))

### Done

**Justin Lee**

- owned: Nested terminal emulator program ([PR #28](https://github.com/just1nlee/osu-capstone/pull/28))
- reviewed: MediaPipe model prototype, made sure that the team members that worked on this could explain to me at a high level how it works and how it was integrated([PR #25](https://github.com/just1nlee/osu-capstone/pull/25))
- shipped: I shipped a working, minimal nested terminal emulator program. It works because when you check the PID of the terminal emulator that runs the nested terminal emulator program, the PIDs are different. It is still extremely barebones as the outer terminal program is handling all of the rendering, but in the next coming sprints the plan is to implement the libghostty-vt C library for terminal emulation so we can begin multiplexing multiple instances.

**Havel Konda**

- owned:
- reviewed:
- shipped:

**Tobi Kohn**

- owned:
- reviewed: Did not review anything.
- shipped:

**Farzaan Wadiwalla**

- owned: RFC-004:
- reviewed: Did not review anything.
- shipped:

**Decision chaired this sprint:** who drove which decision to a conclusion. Over a term everyone should appear here at least once.

- Tobias Kohn: Drove a decision to \_\_\_

## 3. Top Risk and Decisions

- **Top risk:**
  Writing a VT parser from scratch will be very difficult and take a lot of time. If an external library like libghostty-vt is not used, the terminal multiplexer application will not be completed for a long time, so linking the gesture recognition model to the multiplexer will also stall.
- **Decision needed (from the team, by Wed 11/11):** Vote on the programming language we will use for the headless MediaPipe gesture recognition model program: the frameworks supports Python and JavaScript/TypeScript, which are the main viable options for our project.
- **Previous note's decision**: The team successfully settled on the application architecture on 10/27/26, deciding on a C-based multiplexer with a headless MediaPipe gesture recognition model program, and an Electron-based companion application for debugging.

## 4. Judgment Layer (human-written, about five lines)

This sprint, we learned more about the overall architecture of the entire project and how the different modules will connect. From the gesture recognition model prototype, we are more comfortable with Electron and MediaPipe and we confirmed that these technologies will work for our project. With the nested terminal emulator program, we realized that systems programming is difficult and time consuming. We are heavily leaning towards using an external C library, libghostty-vt, to handle the terminal emulation rather than write a VT parser ourselves. This will allow us to focus more on the human-sided application and interaction of this gesture-control multiplexer, rather than spending time on the terminal multiplexer itself. With these two individual components, we have a better understanding of the project's system design. We were able to see what type of output MediaPipe produced, which paints a better picture of what the endpoints of the multiplexer will expose and how they will communicate through IPC. From our current position, we can now move towards adding more gestures/motions and improving the performance of the gesture recognition model, as well as building out more of the multiplexer in the upcoming sprints.
