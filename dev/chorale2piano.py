# SPDX-FileCopyrightText: The Plinky Authors
# SPDX-License-Identifier: 0BSD

"""Batch-converts craigsapp/bach-370-chorales (four-part SATB **kern) to two-staff piano
MusicXML (.mxl), so the chorales enter the piano catalogue as playable grand-staff pieces.

Each chorale ships as four vocal spines (Soprano, Alto, Tenor, Bass). A pianist plays them
as a keyboard reduction — the two upper voices on the treble staff, the two lower on the
bass staff — so this collapses S+A into one staff and T+B into another via music21's
chordify (faithful pitches + rhythm; independent stems are traded for robustness across
370 varied files). Both staves are emitted as one braced Piano instrument, i.e. two
score-parts named "Piano", which the solo-piano import gate accepts.

Usage: python3 dev/chorale2piano.py <repo-dir> <out-dir> <id-prefix>   (mirrors krn2mxl.py)
"""

import html
import re
import sys
from pathlib import Path

from music21 import clef, converter, instrument, layout, metadata, stream


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def krn_headers(krn):
    """The chorale's reference records (!!!OTL / !!!SCT / !!!PC#), HTML-entity-decoded
    (the corpus writes umlauts as &auml; etc.). The first value for each key wins."""
    fields = {}
    for line in Path(krn).read_text(encoding="utf-8", errors="replace").splitlines():
        m = re.match(r"!!!(\S+?):\s*(.+)", line)
        if m and m.group(1) not in fields:
            fields[m.group(1)] = html.unescape(m.group(2).strip())
    return fields


def chorale_title(fields, seen):
    """A clean, unique title. The tune name alone repeats (Bach set many chorales more
    than once), so a BWV is appended, and — only when that still clashes — the corpus's
    unique chorale number, so every distinct harmonization keeps its own entry."""
    name = fields.get("OTL@@DE") or fields.get("OTL") or "Chorale"
    bwv = re.sub(r"^BWV\s*", "", fields.get("SCT", "")).strip()
    candidates = [name, f"{name}, BWV {bwv}" if bwv else name,
                  f"{name}, BWV {bwv} (No. {fields.get('PC#', '?')})"]
    for cand in candidates:
        if cand not in seen:
            seen.add(cand)
            return cand
    unique = f"{name} (No. {fields.get('PC#', '?')})"
    seen.add(unique)
    return unique


def pick(parts, needle, fallback_index):
    """Find the SATB voice by its part name, falling back to kern spine order
    (Bass, Tenor, Alto, Soprano — left to right) when names are absent."""
    for p in parts:
        if needle in (p.partName or "").lower():
            return p
    return parts[fallback_index] if fallback_index < len(parts) else None


def staff_from(upper, lower, which_clef):
    """Chordify two voices into one PartStaff with the given clef, named Piano."""
    merged = stream.Score([upper, lower]).chordify()
    # Drop the inherited SATB instruments (Voice/Bass/Alto/…) so only Piano remains —
    # otherwise their names survive as <instrument-name> and the solo-piano gate reads
    # the score as a vocal ensemble.
    for inst in list(merged.recurse().getElementsByClass(instrument.Instrument)):
        merged.remove(inst, recurse=True)
    ps = stream.PartStaff()
    ps.insert(0, instrument.Piano())
    measures = list(merged.getElementsByClass(stream.Measure))
    if measures:
        measures[0].insert(0, which_clef)
        for m in measures:
            ps.append(m)
    else:  # no measures (unmeasured) — keep the notes so nothing is lost
        ps.insert(0, which_clef)
        for el in merged.notesAndRests:
            ps.append(el)
    return ps


def reduce_chorale(krn, title):
    score = converter.parse(str(krn))
    parts = list(score.parts)
    if len(parts) < 4:
        raise ValueError(f"expected 4 SATB parts, got {len(parts)}")
    sop = pick(parts, "sop", 3)
    alto = pick(parts, "alt", 2)
    ten = pick(parts, "ten", 1)
    bass = pick(parts, "bass", 0)

    treble = staff_from(sop, alto, clef.TrebleClef())
    lower = staff_from(ten, bass, clef.BassClef())

    piano = stream.Score()
    piano.insert(0, treble)
    piano.insert(0, lower)
    piano.insert(0, layout.StaffGroup([treble, lower], symbol="brace", barTogether=True))
    # Carry the composer, and the disambiguated title, into the MusicXML so the importer
    # reads them from work-title / creator.
    md = score.metadata or metadata.Metadata()
    md.title = title
    if not md.composer:
        md.composer = "Bach, Johann Sebastian"
    piano.insert(0, md)
    return piano


def main() -> int:
    repo_dir, out_dir, prefix = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
    out_dir.mkdir(parents=True, exist_ok=True)

    krns = sorted(repo_dir.rglob("*.krn"))
    converted = skipped = failed = 0
    seen: set[str] = set()  # disambiguate repeated tune names across the whole batch
    for krn in krns:
        out = out_dir / f"{prefix}-{slug(krn.stem)}.mxl"
        title = chorale_title(krn_headers(krn), seen)
        if out.exists():
            skipped += 1
            continue
        try:
            reduce_chorale(krn, title).write("mxl", str(out))
            converted += 1
        except Exception as error:  # noqa: BLE001 - a bad file must not abort the batch
            failed += 1
            print(f"  skip {krn.name}: {error}", file=sys.stderr)
        if (converted + failed) % 100 == 0 and converted:
            print(f"  … {converted} converted")

    print(f"{prefix}: {converted} converted, {skipped} cached, {failed} failed ({len(krns)} .krn)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
