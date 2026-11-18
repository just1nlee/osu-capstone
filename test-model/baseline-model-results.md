# Baseline Model Results

| Gesture | Attempts | Correct | Accuracy (%) | Avg. Latency (ms) | Avg. Confidence |
|---|---:|---:|---:|---:|---:|
| `Open_Palm` — Open panel | 15 | 14~ | 93.3%~ | ~35 | ~91.8% |
| `Closed_Fist` — Close panel | 15 | 12* | 80.0%* | N/A | 89.1%† |
| `Thumb_Up` — Next pane | 15 | 14~ | 93.3%~ | ~35 | ~94.2% |
| `Thumb_Down` — Previous pane | 15 | 14~ | 93.3%~ | ~35 | ~92.7% |
| **Overall** | 60 | 54~ | 90.0%~ | ~35 | ~91.9% |

## Notes

The `Closed_Fist` row is based on 334 live-stream output lines over
approximately 43.3 seconds: 327 `Closed_Fist` predictions and 7 `Open_Palm`
predictions. The attempt-level result is provisional because the pasted output
does not include attempt IDs or presentation timestamps.

\* Estimated as 12 correct attempts out of the 15 reported attempts, treating
the three `Open_Palm` detection intervals as incorrect attempts.

† Average confidence across all 334 logged predictions, not one value per
attempt.

Latency was not recorded because the log contains only recognizer timestamps,
not the time each gesture was presented.

The `Open_Palm`, `Thumb_Up`, `Thumb_Down`, and Overall values marked with `~`
are approximate planning estimates, not measured results. Replace them after
running the same live-stream procedure for each gesture. The estimated latency
and confidence values are included only to provide an initial comparison
target.
