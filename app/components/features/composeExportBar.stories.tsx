// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComposeExportBar } from "./composeExportBar";

const meta: Meta<typeof ComposeExportBar> = {
    title: "Features/ComposeExportBar",
    component: ComposeExportBar,
    args: {
        empty: true,
        noteCount: 0,
        copied: false,
        onShare: () => {},
        onDownloadMidi: () => {},
        onDownloadMusicXml: () => {},
        onOpenFile: () => {},
        uploadError: null,
        pendingReplace: false,
        onConfirmReplace: () => {},
        onCancelReplace: () => {},
    },
};
export default meta;

type Story = StoryObj<typeof ComposeExportBar>;

// An empty take: nothing to send anywhere, but opening a file is still the way in.
export const Empty: Story = {};

// With notes recorded, every way out is live.
export const Recorded: Story = { args: { empty: false, noteCount: 47 } };

// Straight after the share link was copied.
export const Copied: Story = { args: { empty: false, noteCount: 47, copied: true } };

// A file that could not be read. The message takes the full width so it is not
// mistaken for a caption on the button beside it.
export const UploadError: Story = {
    args: { uploadError: "That file is not MIDI or MusicXML." },
};

// An opened file waiting on confirmation, because loading it would replace a take
// that is already there.
export const PendingReplace: Story = {
    args: { empty: false, noteCount: 47, pendingReplace: true },
};
