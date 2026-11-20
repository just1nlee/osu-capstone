# Workshop 5: Identify Success Metrics

Project 60: Vision-Based Gesture Control for Terminal Multiplexers

Farzaan Wadiwalla <wadiwalf@oregonstate.edu>, Havel Konda <kondah@oregonstate.edu>, Justin Lee <leeju8@oregonstate.edu>, Tobias Kohn <kohnto@oregonstate.edu>

---

## Metrics

### 1. Gesture Recognition Model Reliability

- **Metric:** Number of unintended commands per 15 minutes of normal keyboard work with the camera on, measured on people who weren’t used to train or tune the model
- **Success:** 1 or fewer, and then we ship the full gesture set and move on to cutting latency
- **Failure:** More than 1, and then we raise the confidence threshold and review the logged false triggers to find which hand motions cause them
- **How we'll collect it:** The gesture recognizer logs every command it sends, with a timestamp and confidence score, to a file. We record each test session on video and mark which commands the person meant to make.

### 2. Multiplexer Performance

- **Metric:** Time to print a 50 MB text file in a single pane, compared to tmux in the same terminal emulator on the same Mac (median of 10 runs)
- **Success:** Within 1.5x of tmux, and then we move on to measuring keystroke latency and multi-pane load
- **Failure:** Slower than 1.5x, and then we profile the output path (escape sequence parsing, screen buffer updates, redraws) to find the bottleneck
- **How we'll collect it:** A script runs the `hyperfine` command that measures execution speed of shell commands on `cat` of the same file inside our multiplexer and inside tmux, and saves the results. This could be configured to run in CI/CD.

**Date committed:** 11/20/26
