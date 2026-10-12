# Contributing Guide

How to set up, code, test, review, and release so contributions meet our Definition of Done.

Project 60, Vision-Based Gesture Control for Terminal Multiplexers. CS 461/462, Oregon State University, 2026 to 2027. Mentor: Prof. Alexander Guyer. Student-proposed project, no external partner, no NDA. This repository is public.

**Sprint key:** Sprint 1 = weeks 3 to 4. Sprint 2 = weeks 5 to 6. Sprint 3 = weeks 7 to 8. Sprint 4 = weeks 9 to 10.

The repository holds documents only so far, and the stack is not settled. Anything below marked **Not yet built** does not exist today, and each one names who writes it and which sprint it lands in. Do not assume a command runs because it appears here.

## Code of Conduct

Behavior expectations are the Inclusion Norms and the Conflict and Accountability path in the Team Charter, in the team Google Drive folder.

Raise a concern with the person directly, or with Havel Konda, Project Manager. If the Project Manager is a party, raise it with Justin Lee, Quality Owner. Either of them escalates to Prof. Guyer and then the instruction team if it does not resolve.

## Getting Started

Prerequisites, setup steps, and the command to run the app: **Not yet built.** Justin writes this section in Sprint 1, as the first code lands.

What works today:

```bash
git clone https://github.com/just1nlee/gesture-control-mux.git
```

**Secrets.** Keep secrets in a local `.env` file. `.env` is gitignored and never committed. Commit a `.env.example` with placeholder keys so a new contributor knows which variables to set. Justin adds both in Sprint 1.

## Branching & Workflow

Trunk-based. `main` is the default branch, is protected, and takes no direct commits.

- Branch from current `main`.
- Name the branch `<initials>/<issue-number>-<short-slug>`, for example `jl/42-pty-resize`.
- Rebase onto `main` to pick up upstream changes while your pull request is open.
- Squash merge into `main`. Delete the branch afterward.

## Issues & Planning

- File a GitHub Issue before you start work. State the problem and what done looks like.
- Use the labels `bug`, `feature`, `docs`, `spike`. Havel creates them in Sprint 1.
- Size issues to fit inside one sprint. Split anything that does not fit at sprint planning.
- Triage the backlog at sprint planning and assign each issue to exactly one person. Leave unassigned issues in the backlog column.
- Issue templates: **Not yet built.** Havel adds them in Sprint 1.

## Commit Messages

Conventional Commits: `<type>: <summary>`, where type is `feat`, `fix`, `docs`, `test`, `refactor`, or `chore`.

```
feat: add pane focus intent to the command bus
fix: handle empty frame from the capture loop
docs: record ADR 0003 on the transport format
```

Reference the issue in the pull request body with `Closes #42`, not in the commit subject.

## Code Style, Linting & Formatting

Formatter, linter, config file locations, and the commands to check and fix locally: **Not yet built.** Justin chooses the tools and writes this section in Sprint 1, once the stack is settled.

Until then, match the style of the code around you and do not reformat files you are not otherwise changing.

## Testing

- Ship a test in the same pull request as any change that adds or alters behavior. Formatting, docs, and comment changes need none.
- Test types, the commands to run them, and the coverage threshold: **Not yet built.** Justin writes the commands in Sprint 1 and sets the coverage threshold in Sprint 2.
- No coverage threshold applies before Sprint 2. Enforcing one against an empty suite measures nothing.

## Definition of Done

A change merges only when every check below passes. A check marked **Not yet built** names the sprint it lands in and its owner.

| Check                              | Enforced by                                              | Status        | Lands    | Owner             |
| ---------------------------------- | -------------------------------------------------------- | ------------- | -------- | ----------------- |
| Automated tests pass               | CI job `test` in `.github/workflows/ci.yml`              | Not yet built | Sprint 1 | Justin Lee        |
| Lint and format clean              | CI job `lint` in `.github/workflows/ci.yml`              | Not yet built | Sprint 1 | Justin Lee        |
| One approving review               | Branch protection rule on `main`                         | Not yet built | Sprint 1 | Justin Lee        |
| Linked to an issue                 | Pull request template checkbox, `Closes #N`              | Not yet built | Sprint 1 | Havel Konda       |
| Docs updated when behavior changes | Pull request template checkbox, verified by the reviewer | Not yet built | Sprint 1 | Farzaan Wadiwalla |
| No secrets committed               | CI job `security` in `.github/workflows/ci.yml`          | Not yet built | Sprint 2 | Tobi Kohn         |
| No known vulnerable dependencies   | CI job `security` in `.github/workflows/ci.yml`          | Not yet built | Sprint 2 | Tobi Kohn         |
| New behavior has a test            | Reviewer judgment, recorded in the review                | Active now    | n/a      | Justin Lee        |

## Contribution Norm

**Every member lands at least one piece of accepted work per sprint.**

Work lives in this repository and on the team's GitHub Projects board. There is no project partner and no partner system.

| Kind of work              | Where it lives                 | Accepted when                                         |
| ------------------------- | ------------------------------ | ----------------------------------------------------- |
| Code                      | This repository                | Merged to `main` having passed the Definition of Done |
| Tests, CI, tooling        | This repository                | Merged to `main` and the job runs in CI               |
| Documentation, ADR        | This repository, under `docs/` | Merged to `main` with one approving review            |
| Sprint note, meeting note | Team Google Drive folder       | Posted to the folder and linked from the board        |
| Research spike            | This repository, under `docs/` | Written up with the finding stated, and merged        |

Keep the norm workable: size issues to one sprint, review within 24 weekday hours, and add a `Co-authored-by:` trailer when two people pair so the work counts for both. If you will not land work in a sprint, say so in Teams before the sprint midpoint so the team can re-scope.

## Pull Requests & Reviews

- Open the pull request against `main` and fill in the template. Havel adds the template in Sprint 1.
- Keep it under roughly 400 changed lines. If it is larger, say why in the description or split it.
- Get one approving review before merging. Do not approve your own pull request.
- Review within 24 weekday hours. A pull request open 72 weekday hours with no review triggers the conflict path in the Team Charter.
- Write comments as requests or questions. Prefix a non-blocking comment with `nit:` and the author may ignore it.
- Resolve your own threads as the author. An unresolved thread blocks the merge.
- Justin reviews every change to CI configuration or to this file, on top of the normal reviewer.
- Farzaan may block a pull request that changes behavior without updating the documentation it makes wrong.
- Required status checks: every CI job in the Definition of Done, once it exists.

## CI/CD

- Pipeline definition: `.github/workflows/ci.yml`. **Not yet built.** Justin adds it in Sprint 1.
- Mandatory jobs as each lands: `test` and `lint` in Sprint 1, `security` in Sprint 2.
- Read logs and re-run failed jobs from the Actions tab of the repository.
- Nothing merges to `main` with a failing required job. CI red on `main` for more than 48 hours triggers the conflict path in the Team Charter.
- There is no deploy stage. This project ships a desktop application, not a hosted service. Packaging is under Release Process.

## Security & Secrets

- **Reporting a vulnerability.** Report it privately to Justin in Microsoft Teams. Do not open a public issue. He acknowledges within 24 weekday hours.
- **Never commit** passwords, API keys, credentials, or ONID logins, anywhere in the repository, including tests, comments, and commit history. Use `.env`.
- **Never commit** raw camera footage or any still frame showing a recognizable person. Commit only derived coordinate output. See the confidentiality boundary in `AGENTS.md`.
- **Dependency updates.** Justin reviews them weekly once dependencies exist. Tobi chooses the automated update tooling in Sprint 2.
- **Scanning.** Tobi adds secret scanning and dependency scanning as the `security` CI job in Sprint 2.

## Documentation Expectations

Farzaan owns `README.md`, the `docs/` directory, and the ADR log. Update the following in the same pull request as the change:

| Change                                                     | Update                                |
| ---------------------------------------------------------- | ------------------------------------- |
| Setup, commands, or how to run the app                     | `README.md` and this file             |
| An architecture, scope, stack, or confidentiality decision | A new ADR in `docs/adr/NNNN-title.md` |
| User-facing behavior                                       | `README.md`                           |
| How AI tools should work in this repository                | `AGENTS.md`, owned by Tobi            |

Comment the non-obvious: why the code exists, not what the line does. Justin adds docstring and comment standards in Sprint 1 alongside the linter configuration.

## Release Process

- Cut a tagged, runnable build before every mentor meeting and every course demo. Justin owns this.
- Versioning scheme, tag format, changelog generation, and packaging: **Not yet built.** Justin writes this section in Sprint 3.
- Rollback: `main` is always releasable, so roll back by checking out the previous tag. Revert a change that broke `main` by pull request, never by force push.

## Support & Contact

| Need                                    | Who                                    | Where                | Response window                                         |
| --------------------------------------- | -------------------------------------- | -------------------- | ------------------------------------------------------- |
| Any question about the code             | The team                               | Teams `#general`     | 24 weekday hours                                        |
| Blocked right now                       | The team                               | Teams `#standup`     | 24 weekday hours                                        |
| CI, tests, releases, Definition of Done | Justin Lee, Quality Owner              | Teams `#general`     | 24 weekday hours                                        |
| Board, scope, scheduling                | Havel Konda, Project Manager           | Teams `#general`     | 24 weekday hours                                        |
| Docs, README, ADRs                      | Farzaan Wadiwalla, Documentation Owner | Teams `#general`     | 24 weekday hours                                        |
| Can I paste this into an AI tool        | Tobi Kohn, AI Coordinator              | Teams `#general`     | 24 weekday hours, and until he answers the answer is no |
| A question for Prof. Guyer              | Havel relays it                        | Teams mentor channel | Next biweekly meeting                                   |
| Course logistics or grading             | The instruction team                   | Canvas               | n/a                                                     |
