import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { BODY, BRAND, C } from "../brand";
import { Background } from "../components/Background";
import { KineticText } from "../components/Kinetic";
import { Burst, LogoMark } from "../components/Logo";
import { clamp } from "../components/motion";

const PILLARS = ["CRM", "Projects", "Invoices", "Expenses", "Reports"];

/** Sign-off: mark, name, the five pillars and a live badge. */
export const Outro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const badge = spring({ frame: frame - 70, fps, config: { damping: 10, stiffness: 140 } });
  const pulse = (Math.sin(frame / 6) + 1) / 2;
  return (
    <AbsoluteFill>
      <Background intensity={1.1} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Burst delay={16} color={C.teal} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
          <LogoMark delay={2} size={150} />
          <KineticText text={BRAND.name} delay={22} size={118} stagger={1.2} />
          <div style={{ display: "flex", gap: 18 }}>
            {PILLARS.map((p, i) => {
              const s = spring({
                frame: frame - 44 - i * 4,
                fps,
                config: { damping: 12, stiffness: 160 },
              });
              return (
                <div
                  key={p}
                  style={{
                    padding: "14px 30px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,.22)",
                    background: "rgba(255,255,255,.06)",
                    fontFamily: BODY,
                    fontSize: 30,
                    fontWeight: 600,
                    color: C.white,
                    transform: `translateY(${(1 - s) * 60}px) scale(${s})`,
                    opacity: Math.min(1, s * 1.5),
                  }}
                >
                  {p}
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 16,
              padding: "22px 48px",
              borderRadius: 999,
              background: `linear-gradient(135deg, ${C.indigoBright}, ${C.teal})`,
              boxShadow: `0 0 ${30 + pulse * 40}px ${C.indigoBright}`,
              fontFamily: BODY,
              fontWeight: 700,
              fontSize: 38,
              color: C.white,
              display: "flex",
              alignItems: "center",
              gap: 18,
              transform: `scale(${badge})`,
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                background: C.white,
                opacity: 0.5 + pulse * 0.5,
              }}
            />
            Live na!
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{ background: C.ink, opacity: interpolate(frame, [130, 150], [0, 1], clamp) }}
      />
    </AbsoluteFill>
  );
};
