import { describe, expect, it } from "vitest";

import { buildPreview, guessMapping, parseCsv } from "@/lib/csv-import";

describe("parseCsv", () => {
  it("reads quoted fields, doubled quotes, embedded commas and line breaks", () => {
    const text = '﻿Name,Notes\r\n"Doe, Jane","She said ""hi""\nthen left"\r\n\r\nBob,plain\n';
    expect(parseCsv(text)).toEqual([
      ["Name", "Notes"],
      ["Doe, Jane", 'She said "hi"\nthen left'],
      ["Bob", "plain"],
    ]);
  });

  it("keeps a last line without a trailing newline and empty cells", () => {
    expect(parseCsv("a,,c\n1,2,")).toEqual([
      ["a", "", "c"],
      ["1", "2", ""],
    ]);
  });
});

describe("guessMapping", () => {
  it("matches common header names regardless of case and spacing", () => {
    const mapping = guessMapping(["Full Name", "E-mail", "Company_Name", "Mobile", "Notes"]);
    expect(mapping).toMatchObject({ name: 0, email: 1, company: 2, phone: 3 });
    expect(mapping.title).toBe(-1);
    expect(mapping.tags).toBe(-1);
  });
});

describe("buildPreview", () => {
  const mapping = guessMapping(["Name", "Email", "Status", "Tags"]);

  it("validates rows, normalises values and reports problems by file line", () => {
    const preview = buildPreview(
      [
        ["Ana Cruz", "ANA@Example.com ", "Lead", "VIP; Referral"],
        ["", "missing@name.test", "", ""],
        ["Bad Email", "not-an-email", "", ""],
        ["Bad Status", "status@x.test", "maybe", ""],
        ["Ana Again", "ana@example.com", "", ""],
        ["Known", "known@x.test", "", ""],
      ],
      mapping,
      ["Known@x.test"],
    );

    expect(preview.ready).toEqual([
      {
        line: 2,
        data: {
          name: "Ana Cruz",
          email: "ana@example.com",
          phone: "",
          title: "",
          company: "",
          status: "lead",
          tags: ["VIP", "Referral"],
        },
      },
    ]);
    expect(preview.errors.map((error) => error.line)).toEqual([3, 4, 5, 6, 7]);
    expect(preview.errors[0].messages).toEqual(["Name is missing."]);
    expect(preview.errors[3].messages).toEqual(["Same email as line 2."]);
    expect(preview.errors[4].messages).toEqual(["A contact with this email already exists."]);
  });

  it("gives one message per field, even when a blank email breaks two rules", () => {
    const preview = buildPreview([["No Email", ""]], guessMapping(["Name", "Email"]), []);
    expect(preview.errors[0].messages).toEqual(["Enter an email address."]);
  });

  it("defaults the status to active when no column is mapped", () => {
    const preview = buildPreview([["Solo", "solo@x.test"]], guessMapping(["Name", "Email"]), []);
    expect(preview.ready[0].data.status).toBe("active");
  });
});
