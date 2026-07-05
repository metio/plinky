// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
