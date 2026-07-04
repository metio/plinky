# SPDX-FileCopyrightText: The Plinky Authors
# SPDX-License-Identifier: 0BSD

"""Harvests DCMLab score corpora (github.com/DCMLab, CC-BY-NC-SA-4.0) into catalogue MusicXML.

DCMLab ships MuseScore `.mscx` (in each repo's MS3/ folder) with embedded title/composer
metadata AND Roman-numeral harmonic-analysis annotations. This batch-converts the .mscx to
MusicXML with the real MuseScore 3.6.2 (the reference reader for that format), strips the
`<harmony>` analysis chord symbols so only the notation reaches the catalogue, and writes a
compressed `.mxl` per piece into <out>/ — ingested by the `dcml` preconverted source config.

Runs in dev/musescore.Containerfile (MuseScore needs a virtual X server). Usage:
  python3 dev/dcml-harvest.py <out-dir> <corpus-dir>...
where each <corpus-dir> is a cloned DCMLab repo (its scores under MS3/); the corpus name
(the dir's basename) prefixes each output file: dcml-<corpus>-<stem>.mxl.
"""

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

# The analysis corpora embed Roman-numeral chord symbols as <harmony>; drop them so the
# score shows only its notation, not a musicology overlay.
HARMONY = re.compile(r"<harmony\b.*?</harmony>\s*", re.S)


def _tag(xml, tag):
    m = re.search(rf"<{tag}>([^<]*)</{tag}>", xml)
    return m.group(1).strip() if m else ""


def build_title(xml):
    """A distinct title from the score header. DCMLab's title fields are uneven: some
    corpora name the piece in <movement-title> (Kinderszenen → "Von fremden Ländern und
    Menschen"), while others (Chopin's Mazurkas) leave it empty and carry the identity in
    <work-number> (Op. 30) + <movement-number> — so all four fields are combined, else
    every mazurka would collapse to the bare set title "Mazurkas" and dedup to one."""
    work = _tag(xml, "work-title")
    number = _tag(xml, "work-number")  # opus, e.g. "Op. 30"
    movement = _tag(xml, "movement-title")
    index = _tag(xml, "movement-number")
    base = work
    if number and number.lower() not in work.lower():
        base = f"{base} {number}".strip()
    if movement:
        return f"{base} — {movement}" if base else movement
    if index:
        return f"{base} No. {index}".strip()
    return base or movement or "Untitled"


def set_title(xml, title):
    """Store the built title as <movement-title> (dropping any existing one), placed just
    before <identification> so MusicXML element order stays valid. The `dcml` source uses
    titleField:"movement", so this becomes the catalogue title."""
    esc = title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    xml = re.sub(r"<movement-title>.*?</movement-title>\s*", "", xml, flags=re.S)
    return re.sub(r"(<identification\b)", f"<movement-title>{esc}</movement-title>\\1", xml, count=1)

def slug(text):
    """A URL-safe filename token: DCMLab .mscx stems carry dots, parens and accents
    (e.g. "160.08_Le_Mal_du_Pays_(Heimweh)"), which make unsafe ids/URLs."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


CONTAINER = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    "<container><rootfiles>"
    '<rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/>'
    "</rootfiles></container>"
)


def batch_convert(jobs, workdir):
    """Convert every .mscx in one MuseScore process (one X-server startup) via a job file."""
    job_file = workdir / "jobs.json"
    job_file.write_text(json.dumps(jobs), encoding="utf-8")
    subprocess.run(
        ["xvfb-run", "-a", "mscore", "-j", str(job_file)],
        capture_output=True, timeout=1800,
    )


def main():
    out_dir = Path(sys.argv[1])
    corpora = [Path(p) for p in sys.argv[2:]]
    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        jobs, targets = [], []  # targets: (corpus, stem, produced-musicxml-path)
        for corpus in corpora:
            name = corpus.name
            for mscx in sorted((corpus / "MS3").glob("*.mscx")):
                produced = work / f"{name}-{mscx.stem}.musicxml"
                jobs.append({"in": str(mscx), "out": [str(produced)]})
                targets.append((name, mscx.stem, produced))
        print(f"Converting {len(jobs)} .mscx from {len(corpora)} corpora …")
        batch_convert(jobs, work)

        written = missing = 0
        for name, stem, produced in targets:
            if not produced.exists():
                missing += 1
                print(f"  no output for {name}/{stem}", file=sys.stderr)
                continue
            xml = HARMONY.sub("", produced.read_text(encoding="utf-8", errors="replace"))
            xml = set_title(xml, build_title(xml))
            out = out_dir / f"dcml-{slug(name)}-{slug(stem)}.mxl"
            with ZipFile(out, "w", ZIP_DEFLATED) as zf:
                zf.writestr("META-INF/container.xml", CONTAINER)
                zf.writestr("score.xml", xml)
            written += 1
        print(f"DCMLab: wrote {written} .mxl, {missing} failed to convert.")


if __name__ == "__main__":
    main()
