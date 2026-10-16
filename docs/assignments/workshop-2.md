# Workshop 2: Map Your Hard-to-Reverse Decisions

Project 60: Vision-Based Gesture Control for Terminal Multiplexers

Farzaan Wadiwalla <wadiwalf@oregonstate.edu>, Havel Konda <kondah@oregonstate.edu>, Justin Lee <leeju8@oregonstate.edu>, Tobias Kohn <kohnto@oregonstate.edu>

---

| Decision                                                                               | To Reverse                       | Validator                                           |
| -------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------- |
| Gesture vocabulary: which hand poses and motions map to commands the system recognizes | Easy                             |                                                     |
| Intent schema: what information the multiplexer parses                                 | Hard                             | Team, during initial architecture discussion        |
| Process topology: multiplexer itself, headless recognizer, and visual dashboard        | Hard                             | Guyer, at the next biweekly mentor meeting          |
| Process communication: unix socket vs localhost TCP                                    | Easy                             |                                                     |
| Multiplexer architecture: Electron/Tauri vs CLI native                                 | Hard                             | Justin, before beginning multiplexer implementation |
| Multiplexer language: C vs Go                                                          | Hard                             | Justin, before beginning multiplexer implementation |
| Dashboard stack: plain web page vs Electron                                            | Easy                             |                                                     |
| Input method: glasses-mounted camera vs built-in webcam vs EMG band vs hybrid          | Easy                             |                                                     |
| Target platforms: macOS only vs cross platform                                         | Easy (Depending on architecture) |                                                     |
| Repository license: MIT, GPL, or closed-source                                         | Hard                             | Team, before we begin pushing code                  |
