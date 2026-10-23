# Sprint Note: Sprint 1, Project 60

**Team:** Project 60
**Sprint dates:** 10/20/2026 - 10/05/20266
**Date submitted:** 10/23/26

---

## 1. Working Software Evidence

- **Deployed URL / release tag / demo video:** No working prototype yet. The team is finalizing the application architecture and researching custom gesture recognition before implementation.
- **Demo video timestamps:** N/A
- **CI run:** Not yet configured.

## 2. What Got Done

- **Where the work is tracked:** https://github.com/just1nlee/osu-capstone/tree/main
- **Done this sprint:**
  - Created the project repository and project board.
  - Began designing the hybrid multiplexer architecture, with Electron and Tauri under consideration.
  - Researched approaches for training a custom computer vision model to recognize hand gestures.
  - Established a single terminal emulator as the first implementation milestone for the multiplexer.
  - Met with the TA to discuss project direction and progress.
  - Continued organizing and refining project documentation.

## 3. Top Risk and One Decision Needed

- **Top risk:** The team is still finalizing the architecture and custom gesture-recognition approach, which could delay development of a working prototype.
- **Decision needed:** Finalize the GUI framework (Electron or Tauri) for the hybrid multiplexer architecture.
- **Decision owner:** Project team.
- **Deadline:** 11/15/2026

## 4. Contribution Lines

### Justin Lee
- **Owned:** Multiplexer
- **Reviewed:**
  - Decided on multiplexer architecture core, still deciding between electron and rust

### Havel Konda
- **Owned:** Research
- **Reviewed:**
  - Looking into CV model and gesture-recognition strategy

### Tobi Kohn
- **Owned:** Research
- **Reviewed:**
  - Researched different ways for users to create custom gestures for custom keybinds 

### Farzaan Wadiwalla
- **Owned:** Research
  - Looking into CV model and gesture-recognition strategy

**Decision chaired this sprint:** [Student and decision reached]

## 5. Judgment Layer

This sprint, we learned that building a reliable gesture-controlled terminal multiplexer requires more than selecting a gesture recognition model. The recognition approach, application architecture, and communication between components will all affect the complexity of the final system. We have established a hybrid multiplexer direction, but still need to finalize the GUI framework and validate our gesture recognition approach. Next sprint, we will prioritize getting a basic gesture recognition prototype working before expanding into terminal integration. This will help us identify technical limitations early and make architecture decisions based on working evidence rather than assumptions.
