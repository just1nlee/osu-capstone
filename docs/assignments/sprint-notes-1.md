# Sprint Note: Sprint 1, Project 60: Vision-Based Gesture Control for Terminal Multiplexers

<!-- One page maximum. Each numbered section is graded pass/fail (20 points each).
     The evidence may be AI-generated from your repo history and board.
     Two things must be human-written: section 5, and the "shipped" sentence
     in each contribution line. Those are the parts anyone reads. -->

**Team:** Project 60: Vision-Based Gesture Control for Terminal Multiplexers
**Sprint dates:** 10/12/2026 to 10/25/2026
**Date submitted:** 10/25/2026

## 1. Working Software Evidence

- **Deployed URL / release tag / demo video:** No runnable code yet; this sprint went to the architecture and gesture-recognition design, and the first runnable piece (a single terminal emulator) is next sprint’s milestone.
- **Demo video timestamps:** N/A
- **CI run:** Not yet configured.

## 2. What Got Done

- **Where the work is tracked:** https://github.com/just1nlee/osu-capstone/tree/main
- **Done this sprint:**
  - Created the project repository and project board.
  - Began designing the hybrid multiplexer architecture.
  - Researched approaches for training a classifier model to allow MediaPipe to recognize more hand gestures.
  - Established a single terminal emulator as the first implementation milestone for the multiplexer.
  - Met with the TA to discuss project direction and progress.
  - Continued organizing and refining project documentation.

## 3. Top Risk and One Decision Needed

- **Top risk:** The multiplexer architecture is still undecided, so the multiplexer core can't start in Sprint 2. Until it does, the command bus protocol stays undefined, the gesture-recognition work is built against a guessed interface, and Sprint 3's gesture integration has nothing to connect to.
- **Decision needed (from the team, by Wed 10/28):** Vote on RFC-001 (`docs/rfcs/2026-10-25-rfc-draft.md`) to choose the multiplexer architecture: Electron, native C, or hybrid (native C plus an optional Electron companion app).

## 4. Contribution Lines

One line per student, three parts:
(a) the work you owned this sprint, one or more pieces, each with a link or ID (NDA teams: IDs only);
(b) a review you gave (a pull request, spec, design, test plan, document, or dataset), with its link or ID where the review is recorded, and either the change you asked for or, for an approval, what you checked before approving ("LGTM" alone is not a review; if you reviewed nothing this sprint, say so);
(c) one human-written sentence: the most consequential thing you shipped, and how the team knows it works.
If a student has nothing this sprint, their line says so plainly. Mechanical changes (formatter runs, lockfile bumps,
generated files, bulk renames) are normal work but are not evidence; leave them out.

**Justin Lee**

- owned: RFC-001: Electron vs CLI native vs Hybrid for Multiplexer Architecture [PR #1](https://github.com/just1nlee/osu-capstone/pull/1)
- reviewed: Did not review anything this sprint
- shipped: Drafted RFC-001, which looks into the different multiplexer architecture approaches and their pros and cons

**Havel Konda**

- owned: Looking into CV model and gesture-recogntion strategy
- reviewed: RFC-001: Electron vs CLI native vs Hybrid for Multiplexer Architecture [PR #1](https://github.com/just1nlee/osu-capstone/pull/1), RFC-002: Tobi's PR
- shipped:

**Tobi Kohn**

- owned:
- reviewed:
- shipped:

**Farzaan Wadiwalla**

- owned: Looking into CV model and gesture-recognition strategy
- reviewed: RFC-004: Input Method Comparison for Gesture Recognition
- shipped: Nothing this sprint

**Decision chaired this sprint:** who drove which decision to a conclusion. Over a term everyone should appear here at least once.

- Justin Lee: drove the team's decision to settle the multiplexer architecture by a majority vote on RFC-001, by 10/28.

## 5. Judgment Layer (human-written, about five lines)

This sprint, we learned that building a reliable gesture-controlled terminal multiplexer requires more than selecting a gesture recognition model. The recognition approach, application architecture, and communication between components will all affect the complexity of the final system. RFC-001 proposes a hybrid architecture direction for a team vote, however we still need to finalize this decision and validate our gesture recognition approach. Next sprint, we will prioritize getting a basic gesture recognition prototype working before expanding into terminal integration. This will help us identify technical limitations early and make architecture decisions based on working evidence rather than assumptions.
