// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { m } from "../../paraglide/messages.js";
import { IconButton } from "./button";
import { CloseIcon } from "./icons";

// A slide-in settings panel: a right-hand sheet on a wide screen, a bottom sheet
// on a phone, over a dimmed backdrop. A backdrop tap or Escape closes it; focus
// moves into the panel on open and returns to the trigger on close, and Tab is
// trapped inside so it behaves like a modal dialog for a keyboard and for axe.
// It renders through a portal onto the body so it sits above a full-screen score
// (which is itself a fixed z-50 layer). The enter slide honours reduced motion;
// closing unmounts at once.
export function Drawer({
    open,
    onClose,
    title,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    // Off-screen on mount, then slid in on the next frame so the transition runs.
    const [shown, setShown] = useState(false);

    useEffect(() => {
        if (!open) {
            setShown(false);
            return;
        }
        const frame = requestAnimationFrame(() => setShown(true));
        return () => cancelAnimationFrame(frame);
    }, [open]);

    useEffect(() => {
        if (!open || typeof document === "undefined") {
            return;
        }
        const restoreFocus = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
                return;
            }
            const panel = panelRef.current;
            if (event.key !== "Tab" || !panel) {
                return;
            }
            const focusable = panel.querySelectorAll<HTMLElement>(
                'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
            );
            if (focusable.length === 0) {
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        // Freeze the page behind so a scroll gesture on the backdrop can't drift it.
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = previousOverflow;
            restoreFocus?.focus?.();
        };
    }, [open, onClose]);

    if (!open || typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-stretch sm:justify-end">
            <button
                type="button"
                aria-label={m.action_close()}
                tabIndex={-1}
                onClick={onClose}
                className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
                    shown ? "opacity-100" : "opacity-0"
                }`}
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                className={`relative flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-white shadow-xl outline-none transition-transform duration-300 ease-out motion-reduce:transition-none dark:bg-gray-900 sm:h-full sm:max-h-full sm:w-96 sm:max-w-[90vw] sm:rounded-none ${
                    shown
                        ? "translate-y-0 sm:translate-x-0"
                        : "translate-y-full sm:translate-y-0 sm:translate-x-full"
                }`}
            >
                <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {title}
                    </h2>
                    <IconButton onClick={onClose} label={m.action_close()}>
                        <CloseIcon />
                    </IconButton>
                </header>
                <div className="space-y-4 overflow-y-auto px-4 py-4">{children}</div>
            </div>
        </div>,
        document.body,
    );
}
