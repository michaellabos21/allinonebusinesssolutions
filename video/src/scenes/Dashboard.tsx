import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { C } from "../brand";
import { Background } from "../components/Background";
import { Chip, KineticText } from "../components/Kinetic";
import { cameraPath, clamp, easeOut } from "../components/motion";
import { FULL, Ring, Screen } from "../components/Screen";

const HERO = { x: 450, y: 230, w: 960, h: 600 };
const CHART = { x: 470, y: 750, w: 1200, h: 750 };

/** The overview flies in on a 3D arc, then the camera dives into what's owed and what came in. */
export const Dashboard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fly = spring({ frame: frame - 12, fps, config: { damping: 16, stiffness: 70, mass: 1.1 } });
  const camera = cameraPath(frame, [
    [56, FULL],
    [86, HERO],
    [118, HERO],
    [146, CHART],
  ]);
  const ring =
    interpolate(frame, [86, 98], [0, 1], { ...clamp, easing: easeOut }) *
    interpolate(frame, [116, 124], [1, 0], clamp);
  const sweep = interpolate(frame, [140, 170], [-400, 1400], clamp);
  const drift = Math.sin(frame / 30) * 2;

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
        <KineticText text="Buong negosyo mo." delay={0} size={96} exitAt={34} />
        <KineticText
          text="Isang dashboard lang."
          delay={8}
          size={96}
          color={C.indigoBright}
          exitAt={36}
          style={{ marginTop: 6 }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 2200 }}>
        <div
          style={{
            transform: `translateY(${(1 - fly) * 900 + 40}px) rotateX(${(1 - fly) * 50 + 4 + drift}deg) rotateZ(${(1 - fly) * -10}deg) rotateY(${drift}deg) scale(${0.75 + 0.25 * fly})`,
            transformStyle: "preserve-3d",
          }}
        >
          <Screen
            shot="overview"
            width={1360}
            camera={camera}
            url="kasama.space/overview"
            overlay={
              <>
                <Ring r={{ x: 555, y: 340, w: 490, h: 130 }} progress={ring} />
                <div
                  style={{
                    position: "absolute",
                    left: 525,
                    top: 1020,
                    width: 1115,
                    height: 440,
                    overflow: "hidden",
                    mixBlendMode: "screen",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      width: 260,
                      left: sweep,
                      background:
                        "linear-gradient(90deg, transparent, rgba(120,150,255,.55), transparent)",
                      transform: "skewX(-15deg)",
                    }}
                  />
                </div>
              </>
            }
          />
        </div>
      </AbsoluteFill>
      <Chip
        text="₱173,000 waiting to be paid"
        sub="Kita agad ang hindi pa bayad"
        delay={92}
        color={C.amber}
        style={{ left: 70, top: 120 }}
      />
      <Chip
        text="Payments by month"
        sub="Kita mo ang pasok ng pera"
        delay={142}
        color={C.teal}
        style={{ right: 70, bottom: 110 }}
      />
    </AbsoluteFill>
  );
};
