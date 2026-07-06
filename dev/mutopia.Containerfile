# SPDX-FileCopyrightText: The Plinky Authors
# SPDX-License-Identifier: 0BSD

# Import-only image for the Mutopia harvest — NOT the project build image
# (dev/Containerfile). LilyPond is a large toolchain (Guile, fonts), kept out of the lean
# dev/CI container and isolated here. The pipeline is:
#   .ly  --lilypond-->  MIDI  --music21-->  two-staff piano MusicXML
# LilyPond is the reference parser, so it resolves any Mutopia .ly (variables, \relative,
# \repeat) that a source-level converter mishandles; its MIDI is score-exact (not a
# performance), and it emits one track per staff so a piano grand staff survives.
#
# Run via: ilo --no-rc shell --remote-user pwuser --update-remote-user-uid \
#            --containerfile dev/mutopia.Containerfile dev/plinky-mutopia:latest bash -c '…'

FROM docker.io/library/python:3.14-slim-bookworm@sha256:4ff4b92a68355dbdb52584ab3391dff8d371a61d4e063468bfd0130e3189c6d9

RUN apt-get update \
    && apt-get install -y --no-install-recommends lilypond git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir music21

# The slim base ships no non-root user; create the one ilo maps host writes onto
# (ilo --remote-user pwuser --update-remote-user-uid rewrites this uid to the host's).
RUN useradd --create-home pwuser

RUN git config --system --add safe.directory '*'
