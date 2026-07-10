// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import {
    ArchiveIcon,
    ArrowDownIcon,
    ArrowUpIcon,
    BookIcon,
    CalendarIcon,
    CheckIcon,
    ChevronIcon,
    ClockIcon,
    CloseIcon,
    EyeIcon,
    GhostIcon,
    GradCapIcon,
    HandIcon,
    HomeIcon,
    ListIcon,
    MinusIcon,
    NotesIcon,
    PlayIcon,
    PlugIcon,
    PlusIcon,
    PrinterIcon,
    QuestionIcon,
    RotateIcon,
    SlidersIcon,
    SpeakerIcon,
    StarIcon,
    StopIcon,
    UploadIcon,
} from "./icons";

// Every icon in one labelled grid, so the whole set is reviewed as a family:
// consistent stroke weight, size, and optical balance.
const ICONS: [string, ReactNode][] = [
    ["Play", <PlayIcon key="play" />],
    ["Question", <QuestionIcon key="question" />],
    ["Speaker", <SpeakerIcon key="speaker" />],
    ["Stop", <StopIcon key="stop" />],
    ["Printer", <PrinterIcon key="printer" />],
    ["Ghost", <GhostIcon key="ghost" />],
    ["Check", <CheckIcon key="check" />],
    ["Plug", <PlugIcon key="plug" />],
    ["Close", <CloseIcon key="close" />],
    ["Chevron", <ChevronIcon key="chevron" />],
    ["Minus", <MinusIcon key="minus" />],
    ["Plus", <PlusIcon key="plus" />],
    ["Rotate", <RotateIcon key="rotate" />],
    ["ArrowUp", <ArrowUpIcon key="arrow-up" />],
    ["ArrowDown", <ArrowDownIcon key="arrow-down" />],
    ["Star", <StarIcon key="star" />],
    ["Star (filled)", <StarIcon key="star-filled" filled />],
    ["Upload", <UploadIcon key="upload" />],
    ["List", <ListIcon key="list" />],
    ["Clock", <ClockIcon key="clock" />],
    ["Archive", <ArchiveIcon key="archive" />],
    ["Archive (filled)", <ArchiveIcon key="archive-filled" filled />],
    ["Home", <HomeIcon key="home" />],
    ["Book", <BookIcon key="book" />],
    ["Calendar", <CalendarIcon key="calendar" />],
    ["Notes", <NotesIcon key="notes" />],
    ["GradCap", <GradCapIcon key="grad-cap" />],
    ["Hand", <HandIcon key="hand" />],
    ["Eye", <EyeIcon key="eye" />],
    ["Sliders", <SlidersIcon key="sliders" />],
];

const meta: Meta = {
    title: "UI/Icons",
};
export default meta;

type Story = StoryObj;

export const Gallery: Story = {
    render: () => (
        <div className="grid grid-cols-4 gap-4 text-gray-800 sm:grid-cols-6 dark:text-gray-200">
            {ICONS.map(([name, icon]) => (
                <div key={name} className="flex flex-col items-center gap-1">
                    {icon}
                    <span className="text-xs text-gray-500 dark:text-gray-400">{name}</span>
                </div>
            ))}
        </div>
    ),
};
