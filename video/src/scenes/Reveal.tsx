import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { BODY, BRAND, C } from "../brand";
import { Background } from "../components/Background";
import { KineticText } from "../components/Kinetic";
import { Burst, LogoMark } from "../components/Logo";
import { clamp, easeOut } from "../components/motion";

/** Meet the product: the mark assembles, bursts, and the name rises under it. */
export const Reveal = () => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 110], [1.12, 1], { ...clamp, easing: easeOut });
  const lift = interpolate(frame, [30, 50], [0, -60], { ...clamp, easing: easeOut });
  return (
    <AbsoluteFill>
      <Background intensity={1} />
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", transform: `scale(${zoom})` }}
      >
        <Burst delay={20} />
        <div
          style={{
            transform: `translateY(${lift}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 46,
          }}
        >
          <LogoMark delay={4} size={200} />
          <KineticText text={BRAND.name} delay={32} size={128} stagger={1.3} />
          <div
            style={{
              fontFamily: BODY,
              fontSize: 42,
              fontWeight: 500,
              color: "rgba(255,255,255,.75)",
              opacity: interpolate(frame, [60, 74], [0, 1], clamp),
              letterSpacing:
                interpolate(frame, [60, 90], [0.3, 0.02], { ...clamp, easing: easeOut }) + "em",
            }}
          >
            {BRAND.tagline}
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: C.white,
          opacity: interpolate(frame, [18, 20, 30], [0, 0.55, 0], clamp),
        }}
      />
    </AbsoluteFill>
  );
};
