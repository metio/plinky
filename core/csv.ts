// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A cell a spreadsheet would RUN rather than read. Excel, LibreOffice and Sheets all
// treat a leading =, +, - or @ as the start of a formula, and a leading tab or carriage
// return can carry one in past a check that only looks at the first character.
//
// Every exporter here writes text the player (or, for a collected assignment report,
// whoever authored the code they pasted) chose: names, piece titles, free-form session
// labels. So a crafted value puts a live formula in the sheet that gets opened —
// =HYPERLINK carries the reader off to a URL on one click, and on Excel a DDE payload
// does worse. Escaping quotes and commas makes a row PARSE correctly; it does nothing
// about what the spreadsheet then executes.
const FORMULA_START = /^[=+\-@\t\r]/;

// A value with a comma in it would otherwise split a row into two columns, and a leading
// formula character is disarmed with the apostrophe every spreadsheet reads as "what
// follows is text". Such a cell is always quoted too, so a parser that trims whitespace
// can't strip a leading tab back off and re-expose the character behind it.
export function csvCell(value: string): string {
    const guarded = FORMULA_START.test(value);
    const text = guarded ? `'${value}` : value;
    return guarded || /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Rows of already-stringified values as one CSV document, every cell disarmed.
export function toCsv(rows: string[][]): string {
    return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
