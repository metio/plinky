// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The XML boundary seam: how a MusicXML string becomes a walkable document and
// back. Core functions that read or rewrite notation take a codec as a
// parameter and stay free of any parser global — the app injects the browser's
// DOMParser-backed adapter, Node tooling passes one built on linkedom, and a
// test can hand in whichever fits. The type lives in core because core
// signatures speak it; implementations live with the platform that provides
// them.
export type XmlCodec = {
    // The parsed document, or null when the input is not well-formed XML —
    // malformed input is a normal condition (user imports), never a throw.
    parse(xml: string): Document | null;
    serialize(doc: Document): string;
};
