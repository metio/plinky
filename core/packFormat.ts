// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every document the app hands out — a progress bundle, a score library, a teacher's
// assignment — names its own format in a `format` field, so a file picker cannot feed one
// to the reader of another. Those names carried the old brand before the rebrand.
//
// The documents themselves did not change: a progress bundle stores its keys with no
// prefix at all, and the score and assignment shapes are the same fields in the same
// order. The tag is the only thing standing between a file saved under the old name and
// the device it is being restored onto, which is why every reader takes both.
//
// Writers only ever write the current name, so the old one fades out as people re-save.
// Reading it stays, with no end date: a bundle is a backup, and a backup is worth
// restoring years after it was written.
const FORMER: Record<string, string> = {
    "klimpi-progress": "plinky-progress",
    "klimpi-scores": "plinky-scores",
    "klimpi-assignment": "plinky-assignment",
};

// Whether `tag` names `format`, under either the current brand or the old one.
export function isPackFormat(tag: unknown, format: string): boolean {
    return tag === format || (tag !== undefined && tag === FORMER[format]);
}
