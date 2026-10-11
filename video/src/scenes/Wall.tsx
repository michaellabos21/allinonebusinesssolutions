import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

import { C } from "../brand";
import { Background } from "../components/Background";
import { KineticText } from "../components/Kinetic";
import { clamp, easeOut } from "../components/motion";

const COLUMNS = [
  ["overview", "contacts", "invoice", "calendar"],
  ["deals", "reports", "tasks", "catalog"],
  ["invoices", "leads", "estimates", "team"],
  ["projects", "expenses", "overview", "deals"],
  ["reports", "calendar", "invoices", "leads"],
];
const TILE_W = 640;
const TILE_H = 400;
const GAP = 40;

/** Every screen at once: columns of the app streaming past on a tilted plane. */
export const Wall = () => {
  const frame = useCurrentFrame();
  const tilt = interpolate(frame, [0, 130], [0, 1], { ...clamp, easing: easeOut });
  const veil = interpolate(frame, [30, 50], [0, 0.6], clamp);
  return (
    <AbsoluteFill>
      <Background intensity={0.6} />
      <AbsoluteFill style={{ perspective: 1800, alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            gap: GAP,
            transform: `rotateX(${38 - tilt * 8}deg) rotateZ(${-18 + tilt * 4}deg) scale(${1.25 - tilt * 0.15})`,
          }}
        >
          {COLUMNS.map((col, i) => {
            const dir = i % 2 === 0 ? -1 : 1;
            const y = dir * (frame * 6 + i * 90) - 600;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: GAP,
                  transform: `translateY(${y}px)`,
                }}
              >
                {[...col, ...col].map((shot, j) => (
                  <Img
                    key={j}
                    src={staticFile(`screens/${shot}.png`)}
                    style={{
                      width: TILE_W,
                      height: TILE_H,
                      borderRadius: 18,
                      boxShadow: "0 30px 60px rgba(0,0,0,.5)",
                      border: "2px solid rgba(255,255,255,.18)",
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, rgba(11,16,48,${veil + 0.25}) 0%, rgba(11,16,48,${veil * 0.6}) 60%, transparent 100%)`,
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <KineticText text="Clients. Trabaho. Pera." delay={34} size={130} stagger={1.1} />
        <KineticText
          text="Isang lugar lang."
          delay={52}
          size={130}
          color={C.indigoBright}
          style={{ marginTop: 14 }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
