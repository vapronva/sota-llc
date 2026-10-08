"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as Sentry from "@sentry/nextjs";
import {
  type RefObject,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
} from "react";
import { type ShaderMaterial, Texture, Vector2 } from "three";

import type { TiltPosition } from "~/hooks/use-device-orientation";

const CONTEXT_RESTORE_GRACE_MS = 5_000;
const MAX_FRAME_DELTA_S = 0.1;

const BASE_ZOOM = 1.04;
const ZOOM_TRAVEL = 0.08;
const MAX_ZOOM = BASE_ZOOM + ZOOM_TRAVEL;
const ZOOM_EASE_RANGE = ZOOM_TRAVEL / 4;

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform sampler2D uTexture;
  uniform float uTextureAspect;
  uniform sampler2D uNextTexture;
  uniform float uNextTextureAspect;
  uniform float uTransition;
  uniform float uZoom;
  uniform float uNextZoom;
  uniform vec2 uMouse;
  varying vec2 vUv;
  vec3 processImage(sampler2D tex, vec2 uv, float zoom, float texAspect) {
    float screenAspect = uResolution.x / uResolution.y;
    vec2 scale = vec2(1.0);
    if (screenAspect > texAspect) {
      scale.y = texAspect / screenAspect;
    } else {
      scale.x = screenAspect / texAspect;
    }
    vec2 parallaxOffset = (uMouse - 0.5) * 0.035;
    vec2 zoomedUv = (uv - 0.5) * scale / zoom + 0.5 + parallaxOffset;
    float dist = length(uv - 0.5);
    float aberration = dist * 0.002;
    vec3 bgColor = vec3(
      texture2D(tex, zoomedUv + vec2(aberration, 0.0)).r,
      texture2D(tex, zoomedUv).g,
      texture2D(tex, zoomedUv - vec2(aberration, 0.0)).b
    );
    vec3 darkBg = bgColor * 0.3;
    darkBg = pow(darkBg, vec3(1.2));
    darkBg = clamp(darkBg, 0.0, 0.3);
    return darkBg;
  }
  void main() {
    vec2 uv = vUv;
    vec3 current = processImage(uTexture, uv, uZoom, uTextureAspect);
    vec3 next = processImage(uNextTexture, uv, uNextZoom, uNextTextureAspect);
    float fadeOut = smoothstep(0.0, 0.5, uTransition);
    float fadeIn = smoothstep(0.5, 1.0, uTransition);
    vec3 darkBg = mix(current, vec3(0.0), fadeOut);
    darkBg = mix(darkBg, next, fadeIn);
    float strength = 16.0;
    float x = (uv.x + 4.0) * (uv.y + 4.0) * (uTime * 10.0 + 500.0);
    float grain = (mod((mod(x, 13.0) + 1.0) * (mod(x, 123.0) + 1.0), 0.01) - 0.005) * strength;
    vec3 finalColor = darkBg + vec3(grain);
    vec2 vignetteUv = vUv * (1.0 - vUv);
    float vignette = vignetteUv.x * vignetteUv.y * 15.0;
    vignette = pow(vignette, 0.25);
    finalColor *= vignette;
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

type ImageTexture = Texture<HTMLImageElement>;

type ShaderUniforms = ReturnType<typeof createUniforms>;

interface Crossfade {
  progress: number | null;
  zoom: number;
  nextZoom: number;
}

function createUniforms() {
  return {
    uTime: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
    uTexture: { value: null as ImageTexture | null },
    uTextureAspect: { value: 1 },
    uNextTexture: { value: null as ImageTexture | null },
    uNextTextureAspect: { value: 1 },
    uTransition: { value: 0 },
    uZoom: { value: BASE_ZOOM },
    uNextZoom: { value: BASE_ZOOM },
    uMouse: { value: new Vector2(0.5, 0.5) },
  };
}

function getImageAspect({ image }: ImageTexture) {
  return image.naturalWidth / image.naturalHeight;
}

function showTexture(uniforms: ShaderUniforms, texture: ImageTexture) {
  uniforms.uTexture.value = texture;
  uniforms.uTextureAspect.value = getImageAspect(texture);
}

function showNextTexture(uniforms: ShaderUniforms, texture: ImageTexture) {
  uniforms.uNextTexture.value = texture;
  uniforms.uNextTextureAspect.value = getImageAspect(texture);
}

function startCrossfade(
  uniforms: ShaderUniforms,
  crossfade: Crossfade,
  target: ImageTexture,
) {
  const previousTarget = uniforms.uNextTexture.value;
  showNextTexture(uniforms, target);
  if (!previousTarget) {
    showTexture(uniforms, target);
    return;
  }
  showTexture(uniforms, previousTarget);
  if (crossfade.progress !== null) crossfade.zoom = crossfade.nextZoom;
  crossfade.nextZoom = BASE_ZOOM;
  crossfade.progress = 0;
}

function approachMaxZoom(zoom: number, linearStep: number) {
  return zoom + linearStep * Math.min(1, (MAX_ZOOM - zoom) / ZOOM_EASE_RANGE);
}

function advanceCrossfade({
  uniforms,
  crossfade,
  deltaS,
  transitionS,
  zoomPerS,
}: {
  uniforms: ShaderUniforms;
  crossfade: Crossfade;
  deltaS: number;
  transitionS: number;
  zoomPerS: number;
}) {
  crossfade.zoom = approachMaxZoom(crossfade.zoom, deltaS * zoomPerS);
  crossfade.nextZoom = approachMaxZoom(crossfade.nextZoom, deltaS * zoomPerS);
  if (crossfade.progress !== null) {
    crossfade.progress =
      transitionS === 0
        ? 1
        : Math.min(crossfade.progress + deltaS / transitionS, 1);
  }
  const next = uniforms.uNextTexture.value;
  if (crossfade.progress === 1 && next) {
    showTexture(uniforms, next);
    crossfade.zoom = crossfade.nextZoom;
    crossfade.progress = null;
  }
  uniforms.uTransition.value = crossfade.progress ?? 0;
  uniforms.uZoom.value = crossfade.zoom;
  uniforms.uNextZoom.value = crossfade.nextZoom;
}

function useImageTextures(images: readonly HTMLImageElement[]) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const texturesRef = useRef(new Map<HTMLImageElement, ImageTexture>());
  const getTexture = useCallback((image: HTMLImageElement) => {
    const cached = texturesRef.current.get(image);
    if (cached) return cached;
    const texture = new Texture(image);
    texture.needsUpdate = true;
    texturesRef.current.set(image, texture);
    return texture;
  }, []);
  useEffect(() => {
    for (const image of images) gl.initTexture(getTexture(image));
    invalidate();
  }, [gl, images, getTexture, invalidate]);
  useEffect(() => {
    const textures = texturesRef.current;
    return () => {
      for (const texture of textures.values()) texture.dispose();
      textures.clear();
    };
  }, []);
  return getTexture;
}

function useContextLossFallback(onContextLost: () => void) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const handleContextNotRestored = useEffectEvent(() => {
    Sentry.captureMessage("WebGL context was not restored", "warning");
    onContextLost();
  });
  useEffect(() => {
    const canvas = gl.domElement;
    let fallbackTimeout: ReturnType<typeof setTimeout> | undefined;
    const handleLost = () => {
      fallbackTimeout = setTimeout(
        () => handleContextNotRestored(),
        CONTEXT_RESTORE_GRACE_MS,
      );
    };
    const handleRestored = () => {
      clearTimeout(fallbackTimeout);
      invalidate();
    };
    canvas.addEventListener("webglcontextlost", handleLost);
    canvas.addEventListener("webglcontextrestored", handleRestored);
    return () => {
      clearTimeout(fallbackTimeout);
      canvas.removeEventListener("webglcontextlost", handleLost);
      canvas.removeEventListener("webglcontextrestored", handleRestored);
    };
  }, [gl, invalidate]);
}

interface NoisePlaneProps {
  images: readonly HTMLImageElement[];
  currentImage: HTMLImageElement;
  slideDurationMs: number;
  transitionDurationMs: number;
  isReducedMotion: boolean;
  tiltRef: RefObject<TiltPosition | null>;
}

interface NoiseSceneProps extends Omit<NoisePlaneProps, "currentImage"> {
  currentImage: HTMLImageElement | undefined;
  onContextLost: () => void;
}

function NoisePlane({
  images,
  currentImage,
  slideDurationMs,
  transitionDurationMs,
  isReducedMotion,
  tiltRef,
}: NoisePlaneProps) {
  const viewport = useThree((state) => state.viewport);
  const invalidate = useThree((state) => state.invalidate);
  const getTexture = useImageTextures(images);
  const initialUniforms = useMemo(() => createUniforms(), []);
  const materialRef = useRef<ShaderMaterial>(null);
  const crossfadeRef = useRef<Crossfade>({
    progress: null,
    zoom: BASE_ZOOM,
    nextZoom: BASE_ZOOM,
  });
  const mouseTarget = useMemo(() => new Vector2(0.5, 0.5), []);
  useEffect(() => {
    invalidate();
  }, [currentImage, isReducedMotion, invalidate]);
  useFrame((state, frameDeltaS) => {
    const material = materialRef.current;
    if (!material) return;
    const uniforms = material.uniforms as ShaderUniforms;
    const crossfade = crossfadeRef.current;
    const deltaS = Math.min(frameDeltaS, MAX_FRAME_DELTA_S);
    const target = getTexture(currentImage);
    if (uniforms.uNextTexture.value !== target) {
      startCrossfade(uniforms, crossfade, target);
    }
    advanceCrossfade({
      uniforms,
      crossfade,
      deltaS,
      transitionS: isReducedMotion ? 0 : transitionDurationMs / 1000,
      zoomPerS: isReducedMotion ? 0 : ZOOM_TRAVEL / (slideDurationMs / 1000),
    });
    uniforms.uResolution.value.set(state.size.width, state.size.height);
    if (isReducedMotion) {
      uniforms.uMouse.value.set(0.5, 0.5);
      return;
    }
    uniforms.uTime.value = state.clock.elapsedTime % 1000;
    const tilt = tiltRef.current;
    mouseTarget.set(
      tilt ? tilt.x * 0.5 + 0.5 : state.pointer.x * 0.15 + 0.5,
      tilt ? tilt.y * 0.5 + 0.5 : state.pointer.y * 0.15 + 0.5,
    );
    uniforms.uMouse.value.lerp(mouseTarget, 1 - 0.95 ** (deltaS * 60));
  });
  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry />
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={initialUniforms}
      />
    </mesh>
  );
}

function SceneContents({
  currentImage,
  onContextLost,
  ...planeProps
}: NoiseSceneProps) {
  useContextLossFallback(onContextLost);
  if (!currentImage) return null;
  return <NoisePlane currentImage={currentImage} {...planeProps} />;
}

export function NoiseScene(props: NoiseSceneProps) {
  const isAnimated = props.currentImage !== undefined && !props.isReducedMotion;
  return (
    <Canvas
      className={props.currentImage ? "animate-fade-in" : "opacity-0"}
      orthographic
      camera={{ zoom: 1, position: [0, 0, 1] }}
      frameloop={isAnimated ? "always" : "demand"}
      gl={{
        antialias: false,
        depth: false,
        stencil: false,
        alpha: false,
        powerPreference: "low-power",
      }}
      dpr={1}
    >
      <SceneContents {...props} />
    </Canvas>
  );
}
