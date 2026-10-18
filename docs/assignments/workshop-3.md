# Workshop 3: Audit Your Safety Net

Project 60: Vision-Based Gesture Control for Terminal Multiplexers

Farzaan Wadiwalla <wadiwalf@oregonstate.edu>, Havel Konda <kondah@oregonstate.edu>, Justin Lee <leeju8@oregonstate.edu>, Tobias Kohn <kohnto@oregonstate.edu>

---

## How a change reaches main

1. Teammates, AI tools, or both, can write and stage code
2. Only teammates should commit code
3. Only teammates should open PRs from a dev branch to merge into staging environment
4. At least 2 teammates need to read over changes and manually accept the changes before merging into staging environment
5. Changes need to be tested in staging by 1 teammate before merging into main environment

## Checks

- Tests for core functionality/behavior
- CI run on every branch PR into main, only allow if green (all tests pass)
- Staging environment that is identical to main to test behavior before pushing to production
- Merging into main gated by manual approval of 2 human reviewers

## Gap

Nothing stops a modified intent schema (i.e. what information the multiplexer parses) from passing CI checks.

## Smallest Change

Write tests that verify the intent schema, so if you want to add new commands or behaviors to the schema you would also have to write tests for them. This way, schema changes must also update the test suite visibly in a PR, which is more likely to be noticed by a human reviewer.
