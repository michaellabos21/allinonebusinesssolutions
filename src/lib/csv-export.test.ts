import { describe, expect, it } from "vitest";

import { toCsv } from "@/lib/csv-export";
import { parseCsv } from "@/lib/csv-import";

describe("toCsv", () => {
  it("quotes commas, quotes and line breaks, and round-trips through the importer", () => {
    const csv = toCsv(
      ["Name", "Notes", "Value"],
      [
        ["Diaz, Inc.", 'Said "maybe"\nnext week', 1500],
        ["Plain", null, 0],
      ],
    );
    expect(csv).toBe(
      'Name,Notes,Value\r\n"Diaz, Inc.","Said ""maybe""\nnext week",1500\r\nPlain,,0\r\n',
    );
    expect(parseCsv(csv)).toEqual([
      ["Name", "Notes", "Value"],
      ["Diaz, Inc.", 'Said "maybe"\nnext week', "1500"],
      ["Plain", "", "0"],
    ]);
  });

  it("stops spreadsheet formulas from running", () => {
    expect(toCsv(["A"], [["=HYPERLINK(1)"], ["+1"], ["@x"], ["-2"]])).toBe(
      "A\r\n'=HYPERLINK(1)\r\n'+1\r\n'@x\r\n'-2\r\n",
    );
  });
});
