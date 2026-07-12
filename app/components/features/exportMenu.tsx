// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type ReactNode, useState } from "react";
import { toMidiNotes } from "../../../core/composition";
import { buildMidiFile } from "../../../core/midiFile";
import { parseMusicXml } from "../../../core/musicxmlParse";
import { transposeMusicXml } from "../../../core/transpose";
import { usePrefsStore, useXmlCodec } from "../../contexts/services";
import { downloadBlob } from "../../lib/download";
import { annotateFingerings } from "../../lib/fingerScore";
import { buildPrintDocument, fileStem, printViaIframe } from "../../lib/printScore";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { DownloadIcon, NotesIcon, PrinterIcon } from "../ui/icons";
import { useTranspose } from "./transposeContext";

// One "Export" disclosure for a piece's take-it-with-you actions — print, MIDI,
// MusicXML — each with a plain-language line saying what the file is for, so a
// less technical player can pick without knowing the formats. Every export is
// derived straight from the MusicXML at the page's current transposition; no
// ScoreViewer or rendered cursor is needed, so any page can place the menu.
export function ExportMenu({
    xml,
    title,
    defaultOpen = false,
}: {
    xml: string;
    title: string;
    // The story renders the panel open; the pages start closed.
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const prefsStore = usePrefsStore();
    const xmlCodec = useXmlCodec();
    const transpose = useTranspose()?.transpose ?? 0;

    const transposed = () => (transpose === 0 ? xml : transposeMusicXml(xmlCodec, xml, transpose));

    // A score that can't be parsed just doesn't export.
    const exportMidi = () => {
        const composition = parseMusicXml(xmlCodec, transposed());
        if (!composition) {
            return;
        }
        downloadBlob(
            buildMidiFile(toMidiNotes(composition), { tempo: composition.tempo }),
            "audio/midi",
            `${fileStem(title)}.mid`,
        );
    };

    const exportMusicXml = () => {
        downloadBlob(
            transposed(),
            "application/vnd.recordare.musicxml+xml",
            `${fileStem(title)}.musicxml`,
        );
    };

    // Prints by rendering its own off-screen staff from the MusicXML — with
    // suggested fingering when hints are on — and handing that SVG to the print
    // dialog. Self-contained: it owns its render rather than borrowing the
    // ScoreViewer's, so Print works in any mode.
    const print = async () => {
        const prefs = prefsStore.load();
        const source = prefs.showFingerings
            ? annotateFingerings(xmlCodec, transposed(), prefs.handSpan)
            : transposed();
        // An off-screen host OSMD renders into; removed once the markup is captured.
        const host = document.createElement("div");
        host.style.position = "absolute";
        host.style.left = "-99999px";
        host.style.top = "0";
        host.style.width = "1000px";
        document.body.appendChild(host);
        // OSMD is heavy and browser-only; load it only on a print click so it stays
        // out of this module's graph (and off the server bundle).
        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
        const osmd = new OpenSheetMusicDisplay(host, {
            autoResize: false,
            drawingParameters: "compact",
        });
        try {
            await osmd.load(source);
            osmd.render();
            const svg = host.querySelector("svg");
            if (!svg) {
                return;
            }
            const html = buildPrintDocument(svg.outerHTML, title);
            const win = window.open("", "_blank");
            if (!win) {
                // Pop-up blocked (common on mobile) — fall back to a hidden iframe.
                printViaIframe(html);
                return;
            }
            win.document.write(html);
            win.document.close();
            win.focus();
            win.print();
        } catch {
            // A score OSMD can't render simply doesn't print.
        } finally {
            osmd.clear();
            host.remove();
        }
    };

    const run = (action: () => void) => () => {
        setOpen(false);
        action();
    };

    return (
        <span className="relative">
            <Button
                variant="ghost"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className="text-indigo-600 dark:text-indigo-400"
            >
                <DownloadIcon className="h-4 w-4" />
                {m.action_export()}
            </Button>
            {open && (
                <span className="absolute right-0 top-full z-30 mt-1 block w-72 rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <ExportRow
                        icon={<PrinterIcon className="h-5 w-5" />}
                        label={m.action_print()}
                        hint={m.export_print_hint()}
                        onClick={run(() => void print())}
                    />
                    <ExportRow
                        icon={<NotesIcon className="h-5 w-5" />}
                        label={m.action_export_midi()}
                        hint={m.export_midi_hint()}
                        onClick={run(exportMidi)}
                    />
                    <ExportRow
                        icon={<DownloadIcon className="h-5 w-5" />}
                        label={m.action_export_musicxml()}
                        hint={m.export_musicxml_hint()}
                        onClick={run(exportMusicXml)}
                    />
                </span>
            )}
        </span>
    );
}

// One explained option: the action's name in front, what the file is for below,
// the whole row one generous touch target.
function ExportRow({
    icon,
    label,
    hint,
    onClick,
}: {
    icon: ReactNode;
    label: string;
    hint: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-start gap-3 rounded-md p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
        >
            <span className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400">{icon}</span>
            <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    {label}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>
            </span>
        </button>
    );
}
