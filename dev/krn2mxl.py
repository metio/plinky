# SPDX-FileCopyrightText: The Plinky Authors
# SPDX-License-Identifier: 0BSD

"""Batch-converts a repo of Humdrum **kern scores to compressed MusicXML (.mxl).

The KernScores corpora (craigsapp/*) ship .krn, which OSMD can't render, so the
importer runs this first. music21 parses **kern and writes .mxl directly (a proper
compressed MusicXML container), carrying the score's !!!OTL / !!!COM metadata into
the MusicXML work-title / composer fields.

Usage: python3 dev/krn2mxl.py <repo-dir> <out-dir> <id-prefix>
Each <repo-dir>/**/*.krn becomes <out-dir>/<id-prefix>-<stem>.mxl. Files music21
can't parse are skipped and counted (a corpus always has a few oddities). Already
converted outputs are left in place so a re-run is cheap.
"""

import re
import sys
from pathlib import Path

from music21 import converter


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def main() -> int:
    repo_dir, out_dir, prefix = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
    out_dir.mkdir(parents=True, exist_ok=True)

    krns = sorted(p for p in repo_dir.rglob("*.krn"))
    converted = skipped = failed = 0
    for krn in krns:
        out = out_dir / f"{prefix}-{slug(krn.stem)}.mxl"
        if out.exists():
            skipped += 1
            continue
        try:
            score = converter.parse(str(krn))
            score.write("mxl", str(out))
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
