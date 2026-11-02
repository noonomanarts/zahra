/** Spreadsheets run cells that start with these characters as formulas, and names are typed by the public. */
export const csvCell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;

/** A download Excel opens with the right encoding (the BOM), so Arabic stays readable. */
export const csvResponse = (body: string, filename: string) =>
  new Response(`﻿${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
