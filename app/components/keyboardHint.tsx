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
                <span className="font-medium">Left hand</span> —{" "}
                <span className="font-mono">A S D F G</span> white keys (C–G),{" "}
                <span className="font-mono">W E&nbsp;&nbsp;T</span> black keys.
            </p>
            <p>
                <span className="font-medium">Right hand</span> —{" "}
                <span className="font-mono">H J K L ;</span> white keys (C–G),{" "}
                <span className="font-mono">U I&nbsp;&nbsp;P</span> black keys.
            </p>
            <p>
                <span className="font-mono">↑ / ↓</span> shift both hands an octave — current offset{" "}
                <span className="font-mono">{formatOffset(octaveOffset)}</span>.
            </p>
        </div>
    );
}
