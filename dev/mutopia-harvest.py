# SPDX-FileCopyrightText: The Plinky Authors
# SPDX-License-Identifier: 0BSD

"""Harvest solo-keyboard pieces from a Mutopia checkout into two-staff piano MusicXML.

The generic LilyPond -> MusicXML path (LilyPond has no native MusicXML export, and
source-level converters drop notes on variable-based scores): compile each .ly with the
real LilyPond to a score-exact MIDI (one track per staff), then music21 reads the MIDI
back and it is re-assembled as a piano grand staff. Title/composer/key come from the .ly
header (MIDI carries none of them). Runs in dev/mutopia.Containerfile.

Harvests Public-Domain, CC-BY and CC-BY-SA solo-keyboard pieces. Each piece's licence is
encoded in the output filename (mutopia-<bucket>-…) so REUSE can annotate by glob and the
importer can assign the per-piece SPDX id — Mutopia's licence varies piece by piece.

Usage: python3 dev/mutopia-harvest.py <mutopia-repo> <out-dir> [--limit N]
"""

import os
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from music21 import clef, converter, instrument, key, layout, metadata, stream

# Solo keyboard, played on a piano. Reject anything with a second player, pedals, or a
# non-keyboard instrument named alongside.
KEYBOARD = re.compile(r"piano|harpsichord|clavier|clavichord|keyboard|cembalo", re.I)
NOT_SOLO = re.compile(r"duet|four hands|4 hands|2 piano|two piano|organ|guitar|voice|"
                      r"violin|viola|cello|flute|choir|\bsatb\b", re.I)


def header(txt, field):
    m = re.search(rf'{field}\s*=\s*"([^"]*)"', txt)
    return (m.group(1).strip() if m else "")


def license_bucket(lic):
    """Map a Mutopia licence string to (filename-bucket, SPDX id), or None to skip.
    The version (2.5/3.0/4.0) is preserved — a CC-BY-2.5 work is not CC-BY-4.0."""
    s = lic.lower().replace("-", " ")
    if "public domain" in s or s.strip() in ("cc0", ""):
        return ("cc0", "CC0-1.0")
    v = re.search(r"([234])\.\d", s)
    ver = v.group(0) if v else "4.0"
    share_alike = "sharealike" in s.replace(" ", "") or "share alike" in s or "by sa" in s
    if "attribution" not in s and "by" not in s.split():
        return None  # not a recognised CC licence (e.g. a plate-number citation)
    tag = "bysa" if share_alike else "by"
    spdx = f"CC-BY{'-SA' if share_alike else ''}-{ver}"
    return (f"{tag}{ver.replace('.', '')}", spdx)


def is_target(txt):
    inst = header(txt, "mutopiainstrument")
    if not KEYBOARD.search(inst) or NOT_SOLO.search(inst):
        return None
    bucket = license_bucket(header(txt, "license") or header(txt, "copyright"))
    return bucket  # (bucket, spdx) or None


def ensure_midi(txt):
    """LilyPond only emits MIDI for a \\score that carries a \\midi block; many Mutopia
    scores have only \\layout. Add a \\midi before the first \\layout when none exists."""
    if re.search(r"\\midi\b", txt):
        return txt
    if re.search(r"\\layout\b", txt):
        return re.sub(r"\\layout\b", r"\\midi { }\n  \\layout", txt, count=1)
    return txt  # no layout either — compile may still fail; caller skips it


def compile_to_midi(ly_path, work):
    src = Path(ly_path).read_text(encoding="utf-8", errors="replace")
    patched = work / "patched.ly"
    patched.write_text(ensure_midi(src), encoding="utf-8")
    subprocess.run(["lilypond", "-dno-point-and-click", "-s", "-o", str(work / "out"), str(patched)],
                   capture_output=True, timeout=180, cwd=str(Path(ly_path).parent))
    midis = list(work.glob("*.mid*"))
    return midis[0] if midis else None


def key_signature(txt):
    m = re.search(r"\\key\s+([a-g])(is|es|s|f)?\s+\\(major|minor)", txt)
    if not m:
        return None
    step = m.group(1).upper()
    accidental = {"is": "#", "es": "-", "s": "-", "f": "-"}.get(m.group(2) or "", "")
    try:
        return key.Key(step + accidental, m.group(3))
    except Exception:
        return None


def to_piano(midi_path, title, composer, ksig):
    score = converter.parse(str(midi_path))
    parts = [p for p in score.parts if list(p.recurse().notes)]
    if not 1 <= len(parts) <= 2:
        raise ValueError(f"{len(parts)} staves — not solo piano")

    staves, clefs = [], [clef.TrebleClef(), clef.BassClef()]
    for idx, part in enumerate(parts):
        ps = stream.PartStaff()
        ps.insert(0, instrument.Piano())
        measures = list(part.getElementsByClass(stream.Measure)) or [part]
        if ksig:
            measures[0].insert(0, key.KeySignature(ksig.sharps))
        measures[0].insert(0, clefs[idx] if len(parts) == 2 else clef.TrebleClef())
        for m in measures:
            ps.append(m)
        if ksig:
            try:
                ps.makeAccidentals(useKeySignature=True, inPlace=True)
            except Exception:
                pass
        staves.append(ps)

    piano = stream.Score()
    for ps in staves:
        piano.insert(0, ps)
    if len(staves) == 2:
        piano.insert(0, layout.StaffGroup(staves, symbol="brace", barTogether=True))
    md = metadata.Metadata()
    md.title = title
    md.composer = composer
    piano.insert(0, md)
    return piano


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60]


def convert_one(job):
    """Worker: compile one .ly and write its two-staff piano .mxl. Returns a status
    string. Self-contained (its own tempdir + music21) so it parallelizes safely —
    every job writes a distinct output filename, so there are no races."""
    ly, out = Path(job["ly"]), Path(job["out"])
    if out.exists():
        return "cached"
    try:
        txt = ly.read_text(encoding="utf-8", errors="replace")
        with tempfile.TemporaryDirectory() as td:
            midi = compile_to_midi(ly, Path(td))
            if not midi:
                return "no-midi"
            piano = to_piano(midi, job["title"], job["composer"], key_signature(txt))
        piano.write("mxl", str(out))
        return "ok"
    except Exception as error:  # noqa: BLE001 — one bad piece must not abort the harvest
        return f"skip {ly.parent.name}/{ly.name}: {str(error)[:70]}"


def main():
    repo, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    out_dir.mkdir(parents=True, exist_ok=True)

    # Scan headers (fast, serial) to build the job list, then compile in parallel —
    # LilyPond's per-invocation startup dominates, so a pool is a big win over ~800 pieces.
    jobs = []
    for ly in sorted(repo.glob("ftp/**/*.ly")):
        txt = ly.read_text(encoding="utf-8", errors="replace")
        target = is_target(txt) if "mutopiatitle" in txt else None
        if not target:
            continue
        bucket, _spdx = target
        title = header(txt, "mutopiatitle") or header(txt, "title") or ly.stem
        # Header composers often trail a life-span — "Isaac Albéniz (1860-1909)"; drop it.
        composer = re.sub(r"\s*\([^)]*\)\s*$", "", header(txt, "composer")
                          or header(txt, "mutopiacomposer"))
        out = out_dir / f"mutopia-{bucket}-{slug(ly.parent.name)}-{slug(ly.stem)}.mxl"
        jobs.append({"ly": str(ly), "out": str(out), "title": title, "composer": composer})
        if limit and len(jobs) >= limit:
            break
    print(f"{len(jobs)} solo-keyboard PD/BY/SA pieces to convert.")

    tally = {"ok": 0, "cached": 0, "no-midi": 0, "skip": 0}
    workers = max(2, (os.cpu_count() or 4) - 1)
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for i, fut in enumerate(as_completed(pool.submit(convert_one, j) for j in jobs), 1):
            res = fut.result()
            key = res if res in tally else "skip"
            tally[key] += 1
            if res.startswith("skip"):
                print(f"  {res}", file=sys.stderr)
            if i % 50 == 0:
                print(f"  … {i}/{len(jobs)} ({tally['ok']} ok)")

    print(f"Mutopia: {tally['ok']} converted, {tally['cached']} cached, "
          f"{tally['no-midi']} no-midi, {tally['skip']} skipped.")


if __name__ == "__main__":
    main()
