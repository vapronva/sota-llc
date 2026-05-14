"use client";

import { useState, useEffect, useRef } from "react";

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
  const handlerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(
    null,
  );
  useEffect(() => {
    handlerRef.current = (event: DeviceOrientationEvent) => {
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
  });
  useEffect(() => {
    if (typeof DeviceOrientationEvent === "undefined") return;
    if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches)
      return;
    const listener = (event: DeviceOrientationEvent) =>
      handlerRef.current?.(event);
    const doe = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (doe.requestPermission) {
      const handleTouch = () => {
        void doe.requestPermission!().then((permission) => {
          if (permission === "granted") {
            window.addEventListener("deviceorientation", listener);
          }
        });
      };
      window.addEventListener("touchstart", handleTouch, {
        capture: true,
        once: true,
        passive: true,
      });
      return () => {
        window.removeEventListener("touchstart", handleTouch, {
          capture: true,
        });
        window.removeEventListener("deviceorientation", listener);
      };
    }
    window.addEventListener("deviceorientation", listener);
    return () => window.removeEventListener("deviceorientation", listener);
  }, []);
  return state;
}
