// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

export function BeatIndicator({ beat, beatsPerBar }: { beat: number; beatsPerBar: number }) {
    return (
        <div className="flex items-center gap-1.5">
            {Array.from({ length: beatsPerBar }, (_, index) => {
                const active = beat === index + 1;
                const downbeat = index === 0;
                return (
                    <span
                        // biome-ignore lint/suspicious/noArrayIndexKey: positions are the stable identity; the list never reorders
                        key={index}
                        className={`inline-block rounded-full transition-colors ${
                            downbeat ? "h-3 w-3" : "h-2.5 w-2.5"
                        } ${active ? "bg-indigo-600" : "bg-gray-300"}`}
                    />
                );
            })}
        </div>
    );
}
