"use client";

import { useEffect, useRef } from "react";

/**
 * Wraps the landing page and runs its motion:
 *   - marks `[data-reveal]` and `[data-wipe]` elements `data-shown` as they
 *     scroll into view (landing.css animates the change);
 *   - tilts the hero screenshot back and flattens it as the page scrolls;
 *   - moves the hero's floating cards a little with the pointer;
 *   - points the feature cards' spotlight at the pointer.
 *
 * The page is complete without this: until the effect runs, or when the
 * visitor prefers reduced motion, `data-motion` stays off and nothing is hidden.
 */
export function LandingMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = root.current;
    if (!page) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    page.dataset.motion = "on";

    // Scroll reveals.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.shown = "";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    page.querySelectorAll("[data-reveal], [data-wipe]").forEach((el) => observer.observe(el));

    // Hero tilt: 18° back at the top of the page, flat once scrolled ~60% of the viewport.
    const stage = page.querySelector<HTMLElement>(".stage-window");
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!stage) return;
        const progress = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.6)));
        const eased = 1 - (1 - progress) ** 3;
        stage.style.setProperty("--tilt", `${18 * (1 - eased)}deg`);
        stage.style.setProperty("--scale", `${0.94 + 0.06 * eased}`);
        stage.style.setProperty("--lift", `${-24 * eased}px`);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Pointer: parallax for the floating cards, spotlight for feature cards.
    const cards = Array.from(page.querySelectorAll<HTMLElement>(".float-card"));
    const onPointer = (event: PointerEvent) => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      for (const card of cards) {
        const depth = Number(card.dataset.depth ?? 20);
        card.style.setProperty("--px", `${x * depth}px`);
        card.style.setProperty("--py", `${y * depth}px`);
      }
      const spot = (event.target as Element | null)?.closest?.<HTMLElement>(".spotlight");
      if (spot) {
        const box = spot.getBoundingClientRect();
        spot.style.setProperty("--mx", `${event.clientX - box.left}px`);
        spot.style.setProperty("--my", `${event.clientY - box.top}px`);
      }
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      delete page.dataset.motion;
    };
  }, []);

  return (
    <div ref={root} className="landing">
      {children}
    </div>
  );
}
