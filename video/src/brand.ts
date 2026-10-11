import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/** Change the name here; nothing else in the video hardcodes it. */
export const BRAND = {
  name: "All in One Business",
  tagline: "Clients, work and money in one place",
};

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;

/** The app's own palette (src/config/app.ts ACCENTS and globals.css). */
export const C = {
  ink: "#0b1030",
  ink2: "#151c48",
  indigo: "#34479e",
  indigoBright: "#5b70d8",
  indigoSoft: "#eceef8",
  teal: "#16a39a",
  plum: "#9b59b6",
  amber: "#f2a33a",
  green: "#1f9d61",
  red: "#d6453d",
  canvas: "#f4f3ef",
  white: "#ffffff",
};

/**
 * The app's own typefaces (src/app/layout.tsx), bundled in public/fonts so the
 * render needs no network. Latin-ext carries the peso sign.
 */
export const DISPLAY = "Bricolage Grotesque";
export const BODY = "Hanken Grotesk";
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+2713, U+FEFF, U+FFFD";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+1E00-1EFF, U+20A0-20AB, U+20AD-20C4, U+2C60-2C7F, U+A720-A7FF";
for (const [family, file, weight] of [
  [DISPLAY, "BricolageGrotesque", "600 800"],
  [BODY, "HankenGrotesk", "400 700"],
] as const) {
  loadFont({ family, url: staticFile(`fonts/${file}.woff2`), weight, unicodeRange: LATIN });
  loadFont({ family, url: staticFile(`fonts/${file}-ext.woff2`), weight, unicodeRange: LATIN_EXT });
}

/** Screenshots are 2400x1500 captures of the app at 1600x1000, 1.5x. */
export const SHOT_W = 2400;
export const SHOT_H = 1500;
