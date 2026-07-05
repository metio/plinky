// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { XmlCodec } from "./xml";

// The metadata a score needs from its MusicXML: what the catalogue shows and
// what the count-in and playback math run on.
export type ScoreMeta = { title: string; composer: string; tempo: number; beatsPerBar: number };

const positiveOr = (value: number, fallback: number): number =>
    Number.isFinite(value) && value > 0 ? value : fallback;

const XML_ENTITIES: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
};

// Resolve the XML entities a title or composer may carry, in a single pass so a
// decoded "&" can't be re-interpreted. This keeps the regex path's text identical
// to what DOMParser.textContent yields on the client (e.g. "Rock &amp; Roll" →
// "Rock & Roll"), so a play page's title and JSON-LD match between the two.
function decodeXmlEntities(text: string): string {
    return text.replace(
        /&(?:#x([0-9a-fA-F]+)|#(\d+)|(amp|lt|gt|quot|apos));/g,
        (_match, hex, dec, named) => {
            if (hex !== undefined) {
                return String.fromCodePoint(Number.parseInt(hex, 16));
            }
            if (dec !== undefined) {
                return String.fromCodePoint(Number.parseInt(dec, 10));
            }
            return XML_ENTITIES[named] ?? _match;
        },
    );
}

// The text pass: a small regex read of the few fields needed, for the bundled
// (well-formed, generated) MusicXML — it needs no parser at all, so the static
// prerender and the module-load-time bundled catalogue stay pure. Its output must
// match what the codec path yields on the same document, so a play page's title
// and JSON-LD agree between prerender and client.
export function readScoreMetaFromText(xml: string): ScoreMeta {
    const pick = (re: RegExp): string => decodeXmlEntities(xml.match(re)?.[1]?.trim() ?? "");
    const title =
        pick(/<work-title>([\s\S]*?)<\/work-title>/) ||
        pick(/<movement-title>([\s\S]*?)<\/movement-title>/) ||
        "Untitled";
    return {
        title,
        composer: pick(/<creator\b[^>]*type="composer"[^>]*>([\s\S]*?)<\/creator>/),
        tempo: Math.round(positiveOr(Number(pick(/<sound\b[^>]*\btempo="([^"]*)"/)), 90)),
        beatsPerBar: positiveOr(Number(pick(/<beats>([\s\S]*?)<\/beats>/)), 4),
    };
}

// Reads the metadata through the injected codec, which tolerates the messier
// MusicXML a user might import; a document the codec cannot parse falls back to
// the text pass, whose defaults keep the score usable.
export function readScoreMeta(codec: XmlCodec, xml: string): ScoreMeta {
    const doc = codec.parse(xml);
    if (!doc) {
        return readScoreMetaFromText(xml);
    }
    const title =
        doc.querySelector("work-title")?.textContent?.trim() ||
        doc.querySelector("movement-title")?.textContent?.trim() ||
        "Untitled";
    const composer = doc.querySelector('creator[type="composer"]')?.textContent?.trim() || "";
    const beats = Number(doc.querySelector("time > beats")?.textContent);
    // A non-numeric tempo attribute (e.g. "andante") would otherwise feed NaN into
    // the 60000/tempo playback and grading math.
    const tempo = Number(doc.querySelector("sound[tempo]")?.getAttribute("tempo"));
    return {
        title,
        composer,
        tempo: Math.round(positiveOr(tempo, 90)),
        beatsPerBar: positiveOr(beats, 4),
    };
}

