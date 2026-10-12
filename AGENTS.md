# AGENTS.md

Context, conventions, and constraints for AI coding tools working in this repository.

This is the cross-tool file and the single source of truth. Per-tool files such as `CLAUDE.md`, `.cursorrules`, or Copilot instructions point here rather than restate anything.

**Owner:** Tobi Kohn, AI Coordinator, Fall 2026. The role rotates each term. See the Team Charter for the schedule.

**Sprint key:** Sprint 1 = weeks 3 to 4. Sprint 2 = weeks 5 to 6. Sprint 3 = weeks 7 to 8. Sprint 4 = weeks 9 to 10.

---

## Project

Project 60, CS 461/462, Oregon State University, 2026 to 2027. Mentor: Prof. Alexander Guyer, EECS. Student-proposed, no external partner, no NDA. This repository is public.

**Vision-Based Gesture Control for Terminal Multiplexers.** A camera watches the user's hands. A recognizer turns hand poses into semantic commands and sends them to a terminal multiplexer, which rearranges its panes in response.

**Scope boundary.** Gestures control navigation and layout only: spawn a pane, focus a pane, rearrange the layout. The keyboard does all actual work. Do not propose gesture-driven scrollback search, copy mode, or text editing.

**Out of scope this year.** Wearable and EMG hardware, and an agent-driven command path. Wanted eventually, not now. Do not scaffold either.

## Stack and conventions

**The stack is not settled.** Do not assume a language, framework, or library. If a task needs one, ask rather than picking.

What is already decided:

| Area      | Choice                                            |
| --------- | ------------------------------------------------- |
| Commits   | Conventional Commits                              |
| Decisions | MADR Architecture Decision Records in `docs/adr/` |
| Branching | Trunk-based, squash merge into a protected `main` |

Read `CONTRIBUTING.md` before proposing a change. It holds the Definition of Done, the review rules, and the pull request workflow, and it is the file to follow when the two disagree with each other.

Prefer the smallest change that passes the Definition of Done. Do not propose an architectural change on your own: that goes to a team vote and an ADR, per section 2 of the Team Charter.

## Confidentiality boundary

The repository is public, so the code is not the sensitive asset. Video of people is.

**Green: safe to send to an approved tool.** Code in this repository, public documentation, issues, pull requests, ADRs, published papers, public datasets.

**Yellow: approved tools only.** Unpublished mentor feedback, grades, course work in progress, team meeting notes, anything a teammate marks yellow.

**Red: no AI tool, and never commit it.** Passwords, API keys, ONID logins. Camera footage or any frame showing a recognizable person, including a debugging screenshot. Signed consent forms. Another student's graded work.

Only derived coordinate output may be committed or shared. Never raw frames.

If you are an AI tool reading this: do not read, request, or include the contents of `data/raw/`, `.env`, or anything in the team's private Drive folder.

## Approved tool registry

A tool missing from this table may not touch Yellow material. Ask Tobi to add one, and he records the date.

| Tool        | Approved for     | Approved by | Date              |
| ----------- | ---------------- | ----------- | ----------------- |
| Claude Code | Green and Yellow | Tobi Kohn   | Week 2, Fall 2026 |

Each member adds the AI tools they use to this table by the end of week 2. Tobi owns the table.

You own the code you submit, whoever wrote the first draft. Read it, understand it, and be ready to defend it at the defense. Say so in the pull request description when a large part of it came from an AI tool.

## To be added once code exists

The repository holds documents only so far. Each gap below has an owner and a sprint.

| Gap                                                                                                                    | Lands    | Owner             |
| ---------------------------------------------------------------------------------------------------------------------- | -------- | ----------------- |
| The stack: languages, frameworks, and why                                                                              | Sprint 1 | Justin Lee        |
| Directory layout and module boundaries                                                                                 | Sprint 1 | Justin Lee        |
| Build, run, and test commands                                                                                          | Sprint 1 | Justin Lee        |
| The command schema: every gesture command, its payload, and its meaning                                                | Sprint 1 | Justin Lee        |
| Lint and format rules, and the config file locations                                                                   | Sprint 1 | Justin Lee        |
| Testing conventions: what gets a unit test, what gets an integration test, how to test the recognizer without a camera | Sprint 2 | Justin Lee        |
| Documentation conventions: docstrings, comments, when an ADR is required                                               | Sprint 2 | Farzaan Wadiwalla |
| Known sharp edges and code not to touch                                                                                | Sprint 3 | Justin Lee        |
| Release and packaging process                                                                                          | Sprint 3 | Justin Lee        |
| The completed tool registry above                                                                                      | Week 2   | Tobi Kohn         |
