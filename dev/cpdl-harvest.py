# SPDX-FileCopyrightText: The Plinky Authors
# SPDX-License-Identifier: 0BSD

"""Harvests public-domain choral editions from CPDL (ChoralWiki) into two-staff piano MusicXML.

CPDL hosts ~67k MusicXML editions of public-domain choral music. Each edition carries its
own licence in the page wikitext (a {{CopyCC|…}} or {{Copy|…}} template beside its file
links). This keeps only editions under a permissive, derivative-allowing licence —
CC0 / CC-BY / CC-BY-SA / Public Domain — because the piano reduction is a derivative work
(so NoDerivatives is excluded) and the catalogue standardises on those SPDX ids
(NonCommercial and the copyleft CPDL license are excluded here). Each kept edition is
reduced — like the Bach chorales — to a piano grand staff: the upper half of the vocal
parts chordified onto the treble staff, the lower half onto the bass; lyrics, vocal
instrument names and vocal clefs are dropped.

Two phases so the large scrape is resumable and its yield is known before downloading:
  plan   — enumerate every score page, parse each edition's licence, write a JSON plan of
           the permissive editions: {page, title, composer, spdx, file}. One per page.
  reduce — download and reduce the planned editions into <out-dir>.

Usage (in dev/Containerfile — needs music21):
  python3 dev/cpdl-harvest.py plan sources/cpdl/plan.json
  python3 dev/cpdl-harvest.py reduce sources/cpdl/plan.json sources/cpdl/_mxl [--limit N]
"""

import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://www.cpdl.org/wiki/api.php"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) plinky-catalogue-research"}


def api(**params):
    params["format"] = "json"
    url = f"{API}?{urllib.parse.urlencode(params)}"
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception:  # noqa: BLE001 - CPDL throws transient 500s; back off and retry
            if attempt == 5:
                raise
            time.sleep(2 * (attempt + 1))
    return {}


# Map a licence template's arguments to an SPDX id, or None to skip the edition. The
# reduction is a derivative, so NoDerivatives is rejected; NonCommercial and the copyleft
# CPDL license are out of the chosen CC/PD set. A version (e.g. 4.0) must be explicit.
def spdx_for(kind, arg):
    text = arg.lower().replace("-", " ")
    if kind == "Copy":
        return "CC0-1.0" if "public domain" in text else None  # {{Copy|CPDL}} etc. skipped
    # {{CopyCC|…}}: the modern, explicitly-versioned CC tags.
    if "no deriv" in text or "noderiv" in text:
        return None
    if "non commercial" in text or "noncommercial" in text:
        return None
    if "zero" in text:
        return "CC0-1.0"
    if "attribution" not in text:
        return None
    version = re.search(r"([234])\.\d", text)
    if not version:
        return None
    share = "sharealike" in text.replace(" ", "") or "share alike" in text
    return f"CC-BY{'-SA' if share else ''}-{version.group(0)}"


LICENCE = re.compile(r"\{\{(CopyCC|Copy)\|([^}]*)\}\}")
MEDIA_MXL = re.compile(r"\[\[Media:([^|\]]+?\.mxl)", re.I)
EDITOR = re.compile(r"\{\{Editor\|")


def parse_page(title, wikitext):
    """The first permissive-licensed edition on the page that has an .mxl. Editions run
    from one {{Editor}} to the next; the licence and file links sit inside that block."""
    m = re.match(r"^(.*?)\s*\(([^()]+)\)\s*$", title)  # "Work Title (Composer)"
    if not m:
        return None
    work, composer = m.group(1).strip(), m.group(2).strip()
    bounds = [e.start() for e in EDITOR.finditer(wikitext)] + [len(wikitext)]
    for i in range(len(bounds) - 1):
        block = wikitext[bounds[i]:bounds[i + 1]]
        lic = LICENCE.search(block)
        mxl = MEDIA_MXL.search(block)
        if not lic or not mxl:
            continue
        spdx = spdx_for(lic.group(1), lic.group(2))
        if spdx:
            return {"page": title, "title": work, "composer": composer,
                    "spdx": spdx, "file": mxl.group(1).replace("_", " ")}
    return None


def build_plan(out_path):
    # Resumable + fault-tolerant: the plan file is a checkpoint {done, apcontinue, plan};
    # it's rewritten every page-batch, so a crash (CPDL throws transient 500s) loses
    # nothing and a re-run continues from the saved apcontinue. A batch that fails after
    # retries is skipped, not fatal.
    out = Path(out_path)
    state = json.loads(out.read_text()) if out.exists() else {}
    plan = state.get("plan", []) if not state.get("done") else []
    apcontinue = "" if state.get("done") else state.get("apcontinue", "")
    scanned = state.get("scanned", 0) if not state.get("done") else 0
    if scanned:
        print(f"  resuming from {scanned} scanned, {len(plan)} planned …", flush=True)

    def checkpoint(done=False):
        out.write_text(json.dumps({"done": done, "apcontinue": apcontinue,
                                   "scanned": scanned, "plan": plan}), encoding="utf-8")

    while True:
        params = dict(action="query", list="allpages", apnamespace=0, aplimit=500)
        if apcontinue:
            params["apcontinue"] = apcontinue
        try:
            data = api(**params)
        except Exception as error:  # noqa: BLE001 - save progress, stop; a re-run resumes
            print(f"  allpages failed ({error}); checkpointed — re-run to resume.", file=sys.stderr)
            checkpoint()
            return
        titles = [p["title"] for p in data.get("query", {}).get("allpages", [])]
        for i in range(0, len(titles), 50):
            batch = titles[i:i + 50]
            try:
                rev = api(action="query", prop="revisions", rvprop="content", rvslots="main",
                          titles="|".join(batch))
            except Exception as error:  # noqa: BLE001 - skip this batch, keep going
                print(f"  batch failed ({error}); skipping 50 pages.", file=sys.stderr)
                scanned += len(batch)
                continue
            for page in rev.get("query", {}).get("pages", {}).values():
                scanned += 1
                try:
                    content = page["revisions"][0]["slots"]["main"]["*"]
                except (KeyError, IndexError):
                    continue
                entry = parse_page(page["title"], content)
                if entry:
                    plan.append(entry)
            time.sleep(0.3)  # be polite to the wiki
        apcontinue = data.get("continue", {}).get("apcontinue", "")
        checkpoint(done=not apcontinue)
        print(f"  scanned {scanned}, planned {len(plan)} CC/PD editions …", flush=True)
        if not apcontinue:
            break

    by_lic = {}
    for e in plan:
        by_lic[e["spdx"]] = by_lic.get(e["spdx"], 0) + 1
    print(f"\nPlan: {len(plan)} permissive editions from {scanned} pages. By licence:")
    for spdx, n in sorted(by_lic.items(), key=lambda kv: -kv[1]):
        print(f"  {spdx}: {n}")


def add_copycc(out_path):
    """Merge the CC-licensed pages into the plan. Unlike the Public-Domain editions (which
    share the generic {{Copy}} template and are only findable by a full scan), the CC
    editions all transclude Template:CopyCC, so `embeddedin` enumerates them directly —
    a few hundred pages instead of the whole wiki."""
    out = Path(out_path)
    state = json.loads(out.read_text()) if out.exists() else {"plan": [], "scanned": 0}
    plan = state.get("plan", [])
    have = {e["page"] for e in plan}

    titles, eicontinue = [], ""
    while True:
        params = dict(action="query", list="embeddedin", eititle="Template:CopyCC",
                      einamespace=0, eilimit=500)
        if eicontinue:
            params["eicontinue"] = eicontinue
        data = api(**params)
        titles += [p["title"] for p in data.get("query", {}).get("embeddedin", [])]
        eicontinue = data.get("continue", {}).get("eicontinue", "")
        if not eicontinue:
            break
    fresh = [t for t in titles if t not in have]
    print(f"{len(titles)} CopyCC pages, {len(fresh)} not already planned.", flush=True)

    added = 0
    for i in range(0, len(fresh), 50):
        batch = fresh[i:i + 50]
        rev = api(action="query", prop="revisions", rvprop="content", rvslots="main",
                  titles="|".join(batch))
        for page in rev.get("query", {}).get("pages", {}).values():
            try:
                content = page["revisions"][0]["slots"]["main"]["*"]
            except (KeyError, IndexError):
                continue
            entry = parse_page(page["title"], content)
            if entry:
                plan.append(entry)
                added += 1
        time.sleep(0.3)
    state.update(done=True, plan=plan)
    out.write_text(json.dumps(state), encoding="utf-8")
    by_lic = {}
    for e in plan:
        by_lic[e["spdx"]] = by_lic.get(e["spdx"], 0) + 1
    print(f"\nPlan: {len(plan)} permissive editions (+{added} CC). By licence:")
    for spdx, n in sorted(by_lic.items(), key=lambda kv: -kv[1]):
        print(f"  {spdx}: {n}")


# --- reduce phase (music21 only imported here so `plan` runs without it) ---

def staff_from_group(parts, which_clef, keep_tempo=True):
    from music21 import clef, instrument, stream, tempo
    merged = stream.Score(list(parts)).chordify()
    for inst in list(merged.recurse().getElementsByClass(instrument.Instrument)):
        merged.remove(inst, recurse=True)
    if not keep_tempo:
        for mark in list(merged.recurse().getElementsByClass(tempo.TempoIndication)):
            merged.remove(mark, recurse=True)
    for inherited in list(merged.recurse().getElementsByClass(clef.Clef)):
        merged.remove(inherited, recurse=True)  # vocal clefs (tenor = treble-8) → impose piano
    # Drop leftover vocal text (incipit words, section labels) carried as text expressions,
    # so only the notation reaches the reduction — the tempo mark is a separate class.
    for text in list(merged.recurse().getElementsByClass("TextExpression")):
        merged.remove(text, recurse=True)
    ps = stream.PartStaff()
    ps.insert(0, instrument.Piano())
    measures = list(merged.getElementsByClass(stream.Measure))
    if measures:
        measures[0].insert(0, which_clef)
        for measure in measures:
            ps.append(measure)
    else:
        ps.insert(0, which_clef)
        for element in merged.notesAndRests:
            ps.append(element)
    return ps


def reduce_choral(mxl_path, title, composer):
    from music21 import clef, converter, layout, metadata, stream
    score = converter.parse(str(mxl_path))
    parts = [p for p in score.parts if list(p.recurse().notes)]
    if len(parts) < 2:
        raise ValueError(f"{len(parts)} voices — not choral")
    for note in score.recurse().notes:
        note.lyrics = []
    split = math.ceil(len(parts) / 2)
    treble = staff_from_group(parts[:split], clef.TrebleClef())
    lower = staff_from_group(parts[split:], clef.BassClef(), keep_tempo=False)
    piano = stream.Score()
    piano.insert(0, treble)
    piano.insert(0, lower)
    piano.insert(0, layout.StaffGroup([treble, lower], symbol="brace", barTogether=True))
    md = metadata.Metadata()
    md.title = title
    md.composer = composer
    piano.insert(0, md)
    return piano


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:70]


# A text direction (incipit words, section labels) carried over from the vocal score. The
# tempered pattern keeps within one <direction>; metronome/dynamics directions are kept.
WORDS_DIRECTION = re.compile(
    r"<direction\b(?:(?!</direction>).)*?<words\b(?:(?!</direction>).)*?</direction>\s*", re.S)


def strip_text_directions(mxl_path):
    """Remove leftover <words> text directions from a written .mxl (music21's TextExpression
    removal is unreliable), string-level so nothing survives — but keep tempo/dynamics."""
    from zipfile import ZIP_DEFLATED, ZipFile
    with ZipFile(mxl_path) as zf:
        data = {n: zf.read(n) for n in zf.namelist()}
    root = re.search(r'full-path="([^"]+)"', data["META-INF/container.xml"].decode()).group(1)
    xml = data[root].decode("utf-8", "replace")
    xml = WORDS_DIRECTION.sub(lambda m: m.group(0) if "<metronome" in m.group(0) else "", xml)
    data[root] = xml.encode("utf-8")
    with ZipFile(mxl_path, "w", ZIP_DEFLATED) as zf:
        for name, blob in data.items():
            zf.writestr(name, blob)

# The filename bucket encodes the per-edition SPDX id (like Mutopia), so the importer can
# tag each piece with its own licence.
BUCKET = {"CC0-1.0": "cc0", "CC-BY-4.0": "by40", "CC-BY-3.0": "by30", "CC-BY-2.5": "by25",
          "CC-BY-SA-4.0": "bysa40", "CC-BY-SA-3.0": "bysa30", "CC-BY-SA-2.5": "bysa25"}


def run_reduce(plan_path, out_dir, limit):
    out = Path(out_dir)
    raw = out.parent / "raw"
    out.mkdir(parents=True, exist_ok=True)
    raw.mkdir(parents=True, exist_ok=True)
    state = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    plan = state["plan"] if isinstance(state, dict) else state
    if limit:
        plan = plan[:limit]

    seen, ok, failed = set(), 0, 0
    for entry in plan:
        key = (entry["composer"].lower(), entry["title"].lower())
        bucket = BUCKET.get(entry["spdx"])
        if key in seen or not bucket:
            continue
        seen.add(key)
        name = f"cpdl-{bucket}-{slug(entry['composer'] + '-' + entry['title'])}"
        target = out / f"{name}.mxl"
        if target.exists():
            ok += 1
            continue
        try:
            src = raw / f"{name}.mxl"
            if not src.exists():  # reuse an already-downloaded edition (re-runs skip CPDL)
                info = api(action="query", titles=f"File:{entry['file']}", prop="imageinfo", iiprop="url")
                url = next(iter(info.get("query", {}).get("pages", {}).values()), {}).get("imageinfo", [{}])[0].get("url")
                if not url:
                    failed += 1
                    continue
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                    src.write_bytes(r.read())
            reduce_choral(src, entry["title"], entry["composer"]).write("mxl", str(target))
            strip_text_directions(target)
            ok += 1
            if ok % 50 == 0:
                print(f"  reduced {ok} …", flush=True)
            time.sleep(0.2)
        except Exception as error:  # noqa: BLE001 - one bad edition must not abort the harvest
            failed += 1
            print(f"  skip {entry['page']}: {str(error)[:70]}", file=sys.stderr)
    print(f"CPDL: {ok} reduced, {failed} failed, {len(seen)} unique works.")


def main():
    if sys.argv[1] == "plan":
        build_plan(sys.argv[2])
    elif sys.argv[1] == "plan-cc":
        add_copycc(sys.argv[2])
    elif sys.argv[1] == "strip":  # re-strip already-reduced .mxl in place (no re-download)
        from glob import glob
        files = glob(f"{sys.argv[2]}/*.mxl")
        for f in files:
            strip_text_directions(f)
        print(f"stripped text directions from {len(files)} files.")
    elif sys.argv[1] == "reduce":
        limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
        run_reduce(sys.argv[2], sys.argv[3], limit)
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
