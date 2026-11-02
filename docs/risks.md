# Risks

Project 60: Vision-Based Gesture Control for Terminal Multiplexers. CS 461/462, Oregon State University, 2026 to 2027. Mentor: Prof. Alexander Guyer.

This is the project's only risk register. It is reviewed at every sprint planning; a risk whose trigger fires becomes an issue on the board, and its entry points at that issue.

**Objective:** a developer at an ordinary laptop navigates and rearranges terminal panes by hand gesture while the keyboard stays for typing, starting with a walking skeleton that installs from GitHub Releases on a machine outside the team by fall week 10.

**Rank:** likelihood/impact, each high, medium, or low (H/M/L), with the reason in parentheses. Sorted with the highest combination first.

## Open

**R-1** team, H/H (repository work began in week 5; the week 10 deployment is a graded milestone).
Repository work started in fall week 5, leaving five weeks for the walking skeleton; if it is not running end to end by week 10, the deployment milestone at Repo Checkpoint 2 is missed.

- Owner: Havel Konda
- Mitigate: cut the skeleton to the thinnest slice (one gesture produces one intent that moves focus between two panes), and keep only skeleton work on the Sprint 2 board.
- Trigger: the skeleton is not running end to end on one laptop by 2026-11-20.

**R-2** technical, M/H (untested on our hardware; every gesture feature depends on it).
Hand-tracking accuracy on ordinary laptop webcams is unmeasured; if it is poor under normal lighting and angles, gestures misfire and the objective fails.

- Owner: Farzaan Wadiwalla
- Mitigate: spike MediaPipe landmark stability on three different laptops.
- Contingency: shrink the gesture set to the most separable poses.
- Trigger: the spike is not done by 2026-11-17, or it shows poses the classifier cannot separate.

**R-3** technical, M/H (no confirm step by design; closing a pane ends its process).
Gestures execute the moment they are recognized; a false positive on a destructive intent closes a pane and kills whatever was running in it.

- Owner: Farzaan Wadiwalla
- Mitigate: open-set rejection, so low-confidence or unknown poses emit no intent, and a higher confidence threshold for destructive intents than for navigation.
- Trigger: any unintended destructive intent during team testing.

**R-4** technical, M/H (three components build against it; expensive to reverse).
The intent schema is the contract between the recognizer and the multiplexer; an unreviewed change breaks one side silently and forces rework on both.

- Owner: Farzaan Wadiwalla
- Mitigate: keep the schema in one versioned file, add a snapshot test that fails on any change to it, and require review from both component owners through CODEOWNERS.
- Trigger: no schema file with its snapshot test by 2026-11-10, or a schema change merged without both owners' review.

**R-5** technical, M/H (nobody on the team has written a VT parser; the terminal core is on the skeleton's path).
The custom C terminal core (PTY handling and VT parsing) is the largest unknown in the systems work; if it runs long, the skeleton has no working terminal.

- Owner: Justin Lee
- Mitigate: the skeleton uses a minimal pass-through terminal, so the parser is off the critical path.
- Contingency: vendor libvterm or libghostty-vt for parsing and keep custom C work in the PTY and layout layers.
- Trigger: the parser does not handle basic escape sequences by 2026-11-24.

**R-7** team, M/M (one owner for the systems side; reviews spread the knowledge).
All multiplexer and terminal core work is owned by one person; if they are away, the systems side stalls and nobody else can review or fix it.

- Owner: Justin Lee
- Mitigate: a teammate reviews every systems pull request, and docs/design.md and AGENTS.md describe the systems layer well enough for someone else to continue.
- Trigger: a systems pull request waits more than three days for a review.

**R-8** team, M/M (pretrained models cover the hard part; the classifier is still new to us).
No team member has prior computer vision or ML experience; if the classifier takes longer to learn than planned, gesture work slips behind the multiplexer.

- Owner: Farzaan Wadiwalla
- Mitigate: start from pretrained MediaPipe Hands (no training) with a simple classifier on landmarks, and ask the mentor for reading on open-set rejection.
- Trigger: no classifier recognizing two poses by 2026-11-20.

**R-9** technical, M/M (macOS warns on or blocks unsigned apps; a workaround exists).
Unsigned macOS builds are blocked or warned against by Gatekeeper, which complicates installing the week 10 build on a machine outside the team.

- Owner: Justin Lee
- Accept for fall, because the workaround is one documented step for the installer.
- Contingency: release notes give the steps to open an unsigned build.
- Start by: 2026-12-04, decide whether to request an Apple Developer Program account ($99/year) for signing in winter.

**R-10** business, M/M (unconfirmed; the objective depends on it).
Nobody outside the team has tried gesture control of panes; if gestures are slower or more tiring than keyboard shortcuts, users keep the keyboard and the project's value is unproven.

- Owner: Havel Konda
- Mitigate: scope gestures to navigation and layout only; run a timed comparison against keyboard shortcuts in winter user sessions.
- Trigger: the first user session finds gestures slower for the core flow.

**R-11** team, H/L (holiday week; a release candidate a week early absorbs it).
Week 9 is Thanksgiving week, reducing team capacity right before the week 10 deployment.

- Owner: Havel Konda
- Mitigate: cut a release candidate by the end of week 8 and keep week 9 for fixes only.
- Trigger: no release candidate by 2026-11-22.

**R-12** business, L/H (the mentor is responsive; the checkpoint milestone depends on it).
The project is student-proposed, so the production target (the week 10 build installable from GitHub Releases on a machine outside the team) needs the mentor's agreement; without it, the Repo Checkpoint 1 milestone is incomplete.

- Asked: Prof. Alexander Guyer, by Justin Lee, 2026-11-01, over Teams.
- Owner: Justin Lee
- Mitigate: confirm at the mentor meeting on 2026-11-03 and record the agreement in docs/design.md.
- Trigger: no agreement by the end of the 2026-11-03 meeting.

**R-13** business, L/H (one volunteer needed; the deployment evidence depends on it).
Deployment evidence at Repo Checkpoint 2 requires someone outside the team to install the build on their own machine; without a volunteer, deployment cannot be shown.

- Start by: 2026-11-22, ask the mentor or a classmate outside the team.
- Owner: Havel Konda
- Mitigate: line up two volunteers in case one is unavailable.
- Trigger: no confirmed volunteer by 2026-11-29.

**R-14** technical, L/H (camera data and secrets are local only today; the repository is public).
The repository is public, so a committed secret, camera recording, or test participant's data would be exposed the moment it is pushed.

- Owner: Tobi Kohn
- Mitigate: camera frames stay in memory and are never written to disk by default; recordings and test data stay out of Git per CONTRIBUTING.md; secret scanning and push protection are on for the repository.
- Trigger: any secret scanning alert, or a recording or data file in a pull request.

**R-15** business, L/M (rules for testing with people outside the team are unconfirmed; winter testing depends on them).
Winter user sessions involve people outside the team; if the course requires an approval for that and it is not requested in time, user testing slips.

- Start by: 2026-12-04, ask the course instructors what approval user testing needs.
- Owner: Havel Konda
- Trigger: no answer from the instructors by the first week of winter term.

## Safety net plan

### Review gates on changes that are expensive to undo

| Gate                                                                                                   | Covers                  | Lands      |
| ------------------------------------------------------------------------------------------------------ | ----------------------- | ---------- |
| Branch protection on `main`: pull request required, one approving review, CI must pass, no force-push  | Every change            | In place   |
| CODEOWNERS on the intent schema file, requiring review from both component owners                      | The intent schema (R-4) | 2026-11-10 |
| CODEOWNERS on `.github/workflows/` and the release configuration, requiring the Quality Owner's review | CI and release changes  | 2026-11-10 |

### Where changes are exercised before they reach users

1. **Every pull request:** CI (Scaffold CI, GitHub Actions on macos-latest) installs the scaffold and runs its behavior tests. In place.
2. **Pre-release builds:** each release candidate is published to GitHub Releases marked as a pre-release and installed on a team laptop other than the author's before it is promoted to a full release. First pre-release by 2026-11-22.

### How a bad change is undone

1. **Bad merge on `main`:** revert the pull request with `git revert`, open the revert as its own pull request, and merge once CI passes. Nobody force-pushes `main`. In place.
2. **Bad release:** mark the release as a pre-release so it is no longer the latest, and point the release notes at the previous good tag. Tags and release builds are never deleted or rewritten. In effect from the first pre-release, 2026-11-22.
3. **Bad intent schema change:** the schema carries a version, and each side rejects messages with a version it does not know rather than guessing, so reverting the schema pull request rolls both components back together. In effect from 2026-11-10.

## Closed

**R-6** Architecture undecided: closed YYYY-MM-DD. The team accepted RFC-001, the hybrid (C multiplexer, headless recognizer, optional Electron companion app), recorded in ADR-0001.

**R-16** Instruction team read access to the repository: not needed, because the repository is public.
