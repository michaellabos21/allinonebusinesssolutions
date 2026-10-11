import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Use a locally installed Chromium when one is provided, e.g.
// REMOTION_BROWSER=/opt/pw-browsers/chromium npm run render
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
