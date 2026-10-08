"use client";

import { useEffect, useRef } from "react";

export interface TiltPosition {
  x: number;
  y: number;
}

type PermissionedOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const MAX_TILT_DEG = 45;
const NEUTRAL_PITCH_DEG = 45;

const clampUnit = (value: number) => Math.max(-1, Math.min(1, value));

function toScreenTilt(beta: number, gamma: number, screenAngleDeg: number) {
  if (screenAngleDeg === 90) return { x: beta, y: -gamma };
  if (screenAngleDeg === 180) return { x: -gamma, y: -beta };
  if (screenAngleDeg === 270) return { x: -beta, y: gamma };
  return { x: gamma, y: beta };
}

function isTouchOnlyDevice() {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

export function useDeviceOrientation(isEnabled: boolean) {
  const tiltRef = useRef<TiltPosition | null>(null);
  useEffect(() => {
    if (!isEnabled || typeof DeviceOrientationEvent === "undefined") return;
    if (!isTouchOnlyDevice()) return;
    let isActive = true;
    const handleOrientation = ({ beta, gamma }: DeviceOrientationEvent) => {
      if (beta === null || gamma === null) return;
      const tilt = toScreenTilt(beta, gamma, screen.orientation?.angle ?? 0);
      tiltRef.current = {
        x: clampUnit(tilt.x / MAX_TILT_DEG),
        y: clampUnit((tilt.y - NEUTRAL_PITCH_DEG) / MAX_TILT_DEG),
      };
    };
    const listenToOrientation = () =>
      window.addEventListener("deviceorientation", handleOrientation);
    const orientationEvent: PermissionedOrientationEvent =
      DeviceOrientationEvent;
    const handleTouchEnd = () => {
      orientationEvent
        .requestPermission?.()
        .then((permission) => {
          if (isActive && permission === "granted") listenToOrientation();
        })
        .catch(() => undefined);
    };
    if (orientationEvent.requestPermission) {
      window.addEventListener("touchend", handleTouchEnd, { once: true });
    } else {
      listenToOrientation();
    }
    return () => {
      isActive = false;
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("deviceorientation", handleOrientation);
      tiltRef.current = null;
    };
  }, [isEnabled]);
  return tiltRef;
}
