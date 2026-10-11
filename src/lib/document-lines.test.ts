import { describe, expect, it } from "vitest";

import { joinLineText, splitLineText } from "./document-lines";

describe("line text", () => {
  it("reads a one-line description as a name with no details", () => {
    expect(splitLineText("Animation")).toEqual({ name: "Animation", details: "" });
  });

  it("splits the name from the details at the first line break", () => {
    expect(splitLineText("Animation\n30-second explainer\n2 rounds of revisions")).toEqual({
      name: "Animation",
      details: "30-second explainer\n2 rounds of revisions",
    });
  });

  it("joins a name and details, and leaves out empty details", () => {
    expect(joinLineText(" Branding ", "Logo and colours ")).toBe("Branding\nLogo and colours");
    expect(joinLineText("Branding", "  ")).toBe("Branding");
  });

  it("keeps the name on one line and normalises Windows line breaks", () => {
    expect(joinLineText("Video\nproduction", "Shoot\r\nEdit")).toBe(
      "Video production\nShoot\nEdit",
    );
  });

  it("round-trips", () => {
    const text = joinLineText("Video production", "One shoot day\nTwo edits");
    expect(joinLineText(splitLineText(text).name, splitLineText(text).details)).toBe(text);
  });
});
