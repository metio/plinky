// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

function formatOffset(offset: number): string {
    return offset > 0 ? `+${offset}` : `${offset}`;
}

export function KeyboardHint({ octaveOffset }: { octaveOffset: number }) {
    return (
        <div className="space-y-1 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            <p className="font-medium text-gray-700">No piano? Play with your computer keyboard:</p>
            <p>
                <span className="font-medium">Right hand</span> —{" "}
                <span className="font-mono">Q W E R T Y U</span> white keys,{" "}
                <span className="font-mono">2 3&nbsp;&nbsp;5 6 7</span> black keys.
            </p>
            <p>
                <span className="font-medium">Left hand</span> —{" "}
                <span className="font-mono">Z X C V B N M</span> white keys,{" "}
                <span className="font-mono">S D&nbsp;&nbsp;G H J</span> black keys.
            </p>
            <p>
                <span className="font-mono">↑ / ↓</span> shift octave — current offset{" "}
                <span className="font-mono">{formatOffset(octaveOffset)}</span>.
            </p>
        </div>
    );
}
