// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { annotateFingerings } from "../lib/fingerScore";
import { usePrefsStore } from "../contexts/services";
import { buildPrintDocument, printViaIframe } from "../lib/printScore";
import { transposeMusicXml } from "../../core/transpose";
import { m } from "../paraglide/messages.js";
import { IconButton } from "./button";
import { PrinterIcon } from "./icons";
import { useTranspose } from "./transposeContext";

// Prints the piece by rendering its own off-screen staff from the MusicXML — at the
// page's transposition, with suggested fingering when hints are on — and handing
// that SVG to the print dialog. Self-contained: it owns its render rather than
// borrowing the ScoreViewer's, so any page can place it and Print works in any mode.
export function PrintButton({ xml, title }: { xml: string; title: string }) {
    const prefsStore = usePrefsStore();
    const transpose = useTranspose()?.transpose ?? 0;
    const print = async () => {
        const prefs = prefsStore.load();
        const transposed = transpose === 0 ? xml : transposeMusicXml(xml, transpose);
        const source = prefs.showFingerings
            ? annotateFingerings(transposed, prefs.handSpan)
            : transposed;
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
    return (
        <IconButton
            variant="ghost"
            onClick={print}
            label={m.action_print()}
            className="text-indigo-600 dark:text-indigo-400"
        >
            <PrinterIcon />
        </IconButton>
    );
}
