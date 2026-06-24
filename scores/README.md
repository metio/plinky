<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: 0BSD
-->

# Scores

Public-domain piano scores in MusicXML, rendered with OpenSheetMusicDisplay.

Drop score files straight into this directory:

- **Format**: uncompressed `.musicxml` (or `.xml`) is simplest. Compressed `.mxl`
  works too — say so and it gets unzipped at build time.
- **Filename**: a kebab-case slug, ideally `composer-piece` —
  e.g. `chopin-prelude-op28-no4.musicxml`. Anything readable is fine; the slug
  becomes the score's id.
- **Metadata**: title and composer are read from the MusicXML itself
  (`<work-title>`, `<creator>`), so no sidecar file is needed.
- **Licensing**: only public-domain works belong here. Each file's SPDX
  declaration lives in the repo's `REUSE.toml` (the format carries no reliable
  place for it inline).

A build step bundles these into the scores registry, seeded onto the device on
first run — the same model the `songs/` catalog uses.
