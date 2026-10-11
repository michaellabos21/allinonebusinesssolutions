import { Composition } from "remotion";

import { FPS, HEIGHT, WIDTH } from "./brand";
import { LaunchVideo, TOTAL_FRAMES } from "./LaunchVideo";

export const Root = () => (
  <Composition
    id="LaunchVideo"
    component={LaunchVideo}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
