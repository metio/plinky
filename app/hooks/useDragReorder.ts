// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type PointerEvent, type RefObject, useRef, useState } from "react";
import { rowAt } from "../../core/reorder";

export type DragReorder = {
    // Attach to the list element whose direct children are the rows.
    listRef: RefObject<HTMLOListElement | null>;
    // The row being dragged, and the row the pointer is currently over.
    dragIndex: number | null;
    overIndex: number | null;
    // Spread onto each row's drag handle.
    handleProps: (index: number) => {
        style: { touchAction: "none" };
        onPointerDown: (event: PointerEvent<HTMLElement>) => void;
        onPointerMove: (event: PointerEvent<HTMLElement>) => void;
        onPointerUp: (event: PointerEvent<HTMLElement>) => void;
        onPointerCancel: () => void;
    };
};

// Drag-to-reorder over pointer events, so one implementation covers mouse, pen,
// and touch (HTML5 drag events never fire on touch). The handle captures the
// pointer, `touch-action: none` keeps the browser from claiming the gesture for
// scrolling, and the drop position comes from comparing the pointer against the
// rows' live midpoints. Purely an enhancement: callers keep their button-based
// reorder affordance as the keyboard and assistive-tech path.
export function useDragReorder(onDrop: (from: number, to: number) => void): DragReorder {
    const listRef = useRef<HTMLOListElement | null>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);

    const midpoints = () =>
        Array.from(listRef.current?.children ?? []).map((child) => {
            const rect = (child as HTMLElement).getBoundingClientRect();
            return rect.top + rect.height / 2;
        });

    const clear = () => {
        setDragIndex(null);
        setOverIndex(null);
    };

    const handleProps = (index: number) => ({
        style: { touchAction: "none" as const },
        onPointerDown: (event: PointerEvent<HTMLElement>) => {
            // Claim the gesture: no text selection, and every later pointer event
            // retargets to the handle even when the pointer leaves it. Capture is
            // best-effort — without it the drag still works while the pointer
            // stays over the handle's row.
            event.preventDefault();
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // No pointer-capture support; proceed uncaptured.
            }
            setDragIndex(index);
            setOverIndex(index);
        },
        onPointerMove: (event: PointerEvent<HTMLElement>) => {
            if (dragIndex !== null) {
                setOverIndex(rowAt(event.clientY, midpoints()));
            }
        },
        onPointerUp: () => {
            if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
                onDrop(dragIndex, overIndex);
            }
            clear();
        },
        onPointerCancel: clear,
    });

    return { listRef, dragIndex, overIndex, handleProps };
}
