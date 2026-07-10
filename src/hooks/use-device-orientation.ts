"use client";

import { useEffect, useRef, useState } from "react";

export interface OrientationPosition {
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function useDeviceOrientation(): {
  positionRef: React.RefObject<OrientationPosition | null>;
  isSupported: boolean;
} {
  const positionRef = useRef<OrientationPosition | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  useEffect(() => {
    if (typeof DeviceOrientationEvent === "undefined") return;
    if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches)
      return;
    let hasSignaledSupport = false;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const { gamma, beta } = event;
      if (gamma == null || beta == null) return;
      positionRef.current = {
        x: clamp(gamma / 45, -1, 1),
        y: clamp((beta - 45) / 45, -1, 1),
      };
      if (!hasSignaledSupport) {
        hasSignaledSupport = true;
        setIsSupported(true);
      }
    };
    const requestPermission = (
      DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      }
    ).requestPermission;
    if (requestPermission) {
      let active = true;
      const handleTouch = () => {
        void requestPermission()
          .then((permission) => {
            if (active && permission === "granted") {
              window.addEventListener("deviceorientation", handleOrientation);
            }
          })
          .catch(() => undefined);
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
  return { positionRef, isSupported };
}
