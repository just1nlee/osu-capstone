"""Run every filter against every scenario at 30 and 15 fps and print a table."""
from filters import NaiveFilter, ConsecutiveFilter, GestureStateMachine
from scenarios import SCENARIOS, build

FILTERS = {
    "A naive": NaiveFilter,
    "B 5-frame": lambda: ConsecutiveFilter(n=5),
    "C state machine": GestureStateMachine,
}


def run_one(make_filter, segments, fps, onset_idx):
    frames, onsets = build(segments, fps)
    flt = make_filter()
    fired = [(f.t_ms, out) for f in frames if (out := flt.update(f))]
    latency = None
    if fired and onset_idx is not None:
        latency = fired[0][0] - onsets[onset_idx]
    return [label for _, label in fired], latency


def main():
    for fps in (30, 15):
        print(f"\n=== {fps} fps ===")
        print(f"{'scenario':30}" + "".join(f"{n:>22}" for n in FILTERS))
        passes = {n: 0 for n in FILTERS}
        counted = 0
        for name, (_, segs, expected, onset, note) in SCENARIOS.items():
            limitation = bool(note)
            counted += not limitation
            cells = []
            for fname, make in FILTERS.items():
                got, lat = run_one(make, segs, fps, onset)
                ok = got == expected
                if ok and not limitation:
                    passes[fname] += 1
                lat_s = f" {lat}ms" if lat is not None else ""
                tag = "n/a" if limitation else ("PASS" if ok else "FAIL")
                cells.append(f"{tag} ({len(got)}/{len(expected)}){lat_s}")
            print(f"{name:30}" + "".join(f"{c:>22}" for c in cells))
        print(f"{'passed':30}" + "".join(f"{passes[n]}/{counted}".rjust(22) for n in FILTERS))
    print("\ncell = result (commands fired / commands expected) first-fire latency")


if __name__ == "__main__":
    main()
