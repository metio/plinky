// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Triggers a browser download of in-memory data as a named file — the one place the
// object-URL dance lives so every export (takes, score packs, assignments, compose)
// shares it. The URL is revoked on the next tick rather than immediately after
// click(): a synchronous revoke races the browser's fetch of the URL and Firefox can
// abort the download outright.
export function downloadBlob(data: BlobPart, type: string, filename: string): void {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

// The two score formats an export can produce, each naming its media type and its extension
// in one place.
//
// They travel together on purpose: a .mid written with the MusicXML media type, or a
// .musicxml written as audio/midi, is a file the operating system hands to the wrong
// application — and nothing in the app would notice, because the download itself succeeds.
export function downloadMidi(data: BlobPart, stem: string): void {
    downloadBlob(data, "audio/midi", `${stem}.mid`);
}

export function downloadMusicXml(xml: BlobPart, stem: string): void {
    downloadBlob(xml, "application/vnd.recordare.musicxml+xml", `${stem}.musicxml`);
}
