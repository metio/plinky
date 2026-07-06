# SPDX-FileCopyrightText: The Plinky Authors
# SPDX-License-Identifier: 0BSD

# Import-only image for the DCMLab harvest — NOT the project build image
# (dev/Containerfile). MuseScore is a heavy GUI toolchain (Qt), kept out of the lean
# dev/CI container and isolated here, like the LilyPond image for Mutopia. The pipeline:
#   .mscx  --musescore3-->  MusicXML  --strip <harmony>-->  clean two-staff piano MusicXML
# MuseScore is the reference reader for its own .mscx, so it converts DCMLab's scores
# exactly; the analysis corpora embed Roman-numeral <Harmony> chord symbols, which the
# harvest strips so only the notation reaches the catalogue.
#
# MuseScore is a GUI app; the 3.6.2 AppImage bundles only Qt's xcb platform plugin (no
# offscreen), so conversion runs under a virtual X server: `xvfb-run -a mscore -o out …`.
#
# Run via: ilo --no-rc shell --remote-user pwuser --update-remote-user-uid \
#            --containerfile dev/musescore.Containerfile dev/plinky-musescore:latest bash -c '…'

FROM docker.io/library/debian:bookworm-slim@sha256:60eac759739651111db372c07be67863818726f754804b8707c90979bda511df

# DCMLab's scores are saved with MuseScore 3.6.2 (file format 3.02), newer than Debian's
# packaged musescore3 (3.2.3), which refuses to open them. The official 3.6.2 AppImage
# reads them exactly; it is extracted (no FUSE) and run through Qt's offscreen platform.
# The AppImage bundles Qt but relies on these system graphics/font/sound libraries.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates git python3 curl xvfb xauth \
        libgl1 libegl1 libglib2.0-0 libfontconfig1 libfreetype6 libpng16-16 \
        libdbus-1-3 libnss3 libasound2 libxrender1 libxext6 libxcb1 libx11-6 \
        libxkbcommon0 libxcomposite1 libxi6 libxtst6 zlib1g fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

ARG MSCORE_URL=https://github.com/musescore/MuseScore/releases/download/v3.6.2/MuseScore-3.6.2.548021370-x86_64.AppImage
RUN curl -fsSL -o /opt/mscore.AppImage "$MSCORE_URL" \
    && cd /opt && chmod +x mscore.AppImage && ./mscore.AppImage --appimage-extract >/dev/null \
    # The extracted tree is root-owned with restrictive modes; ilo runs as pwuser, so
    # open read + traverse (and keep executables executable) for every user.
    && chmod -R a+rX /opt/squashfs-root \
    && printf '#!/bin/sh\nexec /opt/squashfs-root/AppRun "$@"\n' > /usr/local/bin/mscore \
    && chmod +x /usr/local/bin/mscore \
    && rm mscore.AppImage

# The slim base ships no non-root user; create the one ilo maps host writes onto
# (ilo --remote-user pwuser --update-remote-user-uid rewrites this uid to the host's).
RUN useradd --create-home pwuser

RUN git config --system --add safe.directory '*'
