"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  const lastRef = useRef({ x: 0, y: 0 });
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const gamma = event.gamma;
    const beta = event.beta;
    if (gamma == null || beta == null) return;
    const x = Math.max(-1, Math.min(1, gamma / 45));
    const y = Math.max(-1, Math.min(1, (beta - 45) / 45));
    if (
      Math.abs(x - lastRef.current.x) > 0.01 ||
      Math.abs(y - lastRef.current.y) > 0.01
    ) {
      lastRef.current = { x, y };
      setState({ x, y, supported: true });
    }
  }, []);
  useEffect(() => {
    if (typeof DeviceOrientationEvent === "undefined") return;
    const doe = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (doe.requestPermission) {
      const handleTouch = () => {
        void doe.requestPermission!().then((permission) => {
          if (permission === "granted") {
            window.addEventListener("deviceorientation", handleOrientation);
          }
        });
      };
      window.addEventListener("touchstart", handleTouch, {
        capture: true,
        once: true,
      });
      return () => {
        window.removeEventListener("touchstart", handleTouch, {
          capture: true,
        });
        window.removeEventListener("deviceorientation", handleOrientation);
      };
    }
    window.addEventListener("deviceorientation", handleOrientation);
    return () =>
      window.removeEventListener("deviceorientation", handleOrientation);
  }, [handleOrientation]);
  return state;
}
