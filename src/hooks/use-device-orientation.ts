"use client";

import { useState, useEffect } from "react";

interface DeviceOrientationState {
  x: number;
  y: number;
  supported: boolean;
}

export function useDeviceOrientation(): DeviceOrientationState {
  const [state, setState] = useState<DeviceOrientationState>({
    x: 0,
    y: 0,
    supported: false,
  });
  useEffect(() => {
    if (typeof DeviceOrientationEvent === "undefined") return;
    if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches)
      return;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const gamma = event.gamma;
      const beta = event.beta;
      if (gamma == null || beta == null) return;
      const x = Math.max(-1, Math.min(1, gamma / 45));
      const y = Math.max(-1, Math.min(1, (beta - 45) / 45));
      setState((prev) => {
        if (Math.abs(x - prev.x) <= 0.01 && Math.abs(y - prev.y) <= 0.01) {
          return prev;
        }
        return { x, y, supported: true };
      });
    };
    const doe = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (doe.requestPermission) {
      let active = true;
      const handleTouch = () => {
        void doe.requestPermission!().then((permission) => {
          if (active && permission === "granted") {
            window.addEventListener("deviceorientation", handleOrientation);
          }
        });
      };
      window.addEventListener("touchstart", handleTouch, {
        capture: true,
        once: true,
        passive: true,
      });
      return () => {
        active = false;
        window.removeEventListener("touchstart", handleTouch, {
          capture: true,
        });
        window.removeEventListener("deviceorientation", handleOrientation);
      };
    }
    window.addEventListener("deviceorientation", handleOrientation);
    return () =>
      window.removeEventListener("deviceorientation", handleOrientation);
  }, []);
  return state;
}
