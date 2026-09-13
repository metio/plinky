// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { MetronomeDrawing } from "./drawings/metronomeDrawing";
import { LoopDrawing } from "./drawings/loopDrawing";
import { TriadDrawing } from "./drawings/triadDrawing";
import { SwitchField } from "./fields";
import { Folio, FolioFigure, FolioRow, folioDrawingClasses, folioIconClasses } from "./folio";
import { BookIcon, EarIcon, SpeakerIcon } from "./icons";

const meta: Meta<typeof FolioRow> = { title: "UI/Folio", component: FolioRow };
export default meta;

type Story = StoryObj<typeof FolioRow>;

// Drawings in the margin: the shape a list of lessons or ways to practise takes.
export const Drawings: Story = {
    render: () => (
        <Folio>
            <FolioRow
                margin={<LoopDrawing className={folioDrawingClasses} />}
                name="One small piece at a time"
                line="Loop the bar that keeps going wrong."
            />
            <FolioRow
                margin={<MetronomeDrawing className={folioDrawingClasses} />}
                name="Slow enough to get it right"
                line="Slow is the speed where you still choose."
            />
            <FolioRow
                margin={<TriadDrawing className={folioDrawingClasses} />}
                name="Learn the chords, not the notes"
                line="Three notes become one shape."
            />
        </Folio>
    ),
};

// The number in the margin: every figure on the Stats page. The margin grows to the widest
// figure, so the column stays right-aligned.
export const Figures: Story = {
    render: () => (
        <Folio>
            <FolioRow margin={<FolioFigure value={46} />} name="Days you played" />
            <FolioRow margin={<FolioFigure value={12345} />} name="Notes played" />
            <FolioRow margin={<FolioFigure value="1 h 20 min" />} name="Total time" />
        </Folio>
    ),
};

// Line icons in the margin, each row a link: a hub.
export const Links: Story = {
    render: () => (
        <Folio>
            <FolioRow
                to="/theory"
                margin={<BookIcon className={folioIconClasses} />}
                name="How the music works"
                line="Fourteen short lessons on what a stave is telling you."
            />
            <FolioRow
                to="/ear"
                margin={<EarIcon className={folioIconClasses} />}
                name="Ear training"
                line="Name the notes and the distances between them."
            />
        </Folio>
    ),
};

// A row that heads a group and holds its controls beneath the line: a section of Settings.
export const Section: Story = {
    render: () => (
        <FolioRow
            as="section"
            heading="h2"
            margin={<SpeakerIcon className={folioIconClasses} />}
            name="Sound"
            line="What Plinky plays back, and how."
        >
            <SwitchField label="Play sounds" checked={true} onChange={() => {}} />
        </FolioRow>
    ),
};
