"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as Sentry from "@sentry/nextjs";
import { useEffect, useMemo, useRef } from "react";
import {
  LinearFilter,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector2,
} from "three";

const FIRST_TEXTURE_FALLBACK_MS = 3_000;
const ALL_TEXTURES_FALLBACK_MS = 10_000;
const CONTEXT_RESTORE_GRACE_MS = 5_000;

const BASE_ZOOM = 1.04;
const ZOOM_TRAVEL = 0.08;
const MAX_ZOOM = BASE_ZOOM + ZOOM_TRAVEL;

interface ShaderUniforms {
  [uniform: string]: { value: unknown };
  uTime: { value: number };
  uResolution: { value: Vector2 };
  uTexture: { value: Texture | null };
  uTextureAspect: { value: number };
  uNextTexture: { value: Texture | null };
  uNextTextureAspect: { value: number };
  uTransition: { value: number };
  uZoom: { value: number };
  uNextZoom: { value: number };
  uMouse: { value: Vector2 };
}

export interface SlideData {
  url: string;
  credit: string;
  creditLink: string;
}

export interface PointerOverride {
  readonly current: { x: number; y: number } | null;
}

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

function getTextureAspect(texture: Texture | null): number {
  return (texture?.userData?.aspect as number | undefined) ?? 1;
}

function clampSlideIndex(index: number, slideCount: number): number {
  if (slideCount === 0) return 0;
  return Math.max(0, Math.min(index, slideCount - 1));
}

interface SlideTexturesOptions {
  slideUrls: string[];
  onTextureLoaded: () => void;
  onAllTexturesLoaded: () => void;
  onSlideError?: (index: number) => void;
}

function useSlideTextures({
  slideUrls,
  onTextureLoaded,
  onAllTexturesLoaded,
  onSlideError,
}: SlideTexturesOptions): Texture[] {
  const { gl } = useThree();
  const onLoadedRef = useRef(onTextureLoaded);
  const onAllLoadedRef = useRef(onAllTexturesLoaded);
  const onSlideErrorRef = useRef(onSlideError);
  useEffect(() => {
    onLoadedRef.current = onTextureLoaded;
    onAllLoadedRef.current = onAllTexturesLoaded;
    onSlideErrorRef.current = onSlideError;
  }, [onTextureLoaded, onAllTexturesLoaded, onSlideError]);
  const loadedCountRef = useRef(0);
  const hasInitialSignalRef = useRef(false);
  const hasAllSignalRef = useRef(false);
  const textures = useMemo<Texture[]>(
    () =>
      slideUrls.map(() => {
        const tex = new Texture();
        tex.minFilter = LinearFilter;
        tex.magFilter = LinearFilter;
        tex.userData.aspect = 1;
        return tex;
      }),
    [slideUrls],
  );
  useEffect(() => {
    const loader = new TextureLoader();
    loader.crossOrigin = "anonymous";
    let cancelled = false;
    const total = slideUrls.length;
    const signalTextureSettled = () => {
      if (cancelled) return;
      loadedCountRef.current += 1;
      if (!hasInitialSignalRef.current && loadedCountRef.current >= 1) {
        hasInitialSignalRef.current = true;
        onLoadedRef.current();
      }
      if (!hasAllSignalRef.current && loadedCountRef.current >= total) {
        hasAllSignalRef.current = true;
        onAllLoadedRef.current();
      }
    };
    const handleTextureLoaded = (target: Texture, loaded: Texture) => {
      if (cancelled) return;
      const img = loaded.image as { width: number; height: number };
      target.image = loaded.image;
      target.userData.aspect = img.width / img.height;
      target.needsUpdate = true;
      gl.initTexture(target);
      signalTextureSettled();
    };
    const handleTextureError = (index: number, url: string) => {
      if (cancelled) return;
      console.error("Failed to load slide texture", { url });
      Sentry.captureMessage("Failed to load slide texture", {
        level: "error",
        extra: { url },
      });
      onSlideErrorRef.current?.(index);
      signalTextureSettled();
    };
    const loadRemainingTextures = () => {
      for (let i = 1; i < slideUrls.length; i++) {
        const url = slideUrls[i]!;
        const tex = textures[i]!;
        loader.load(
          url,
          (loaded) => handleTextureLoaded(tex, loaded),
          undefined,
          () => handleTextureError(i, url),
        );
      }
    };
    const firstUrl = slideUrls[0]!;
    const firstTexture = textures[0]!;
    loader.load(
      firstUrl,
      (loaded) => {
        handleTextureLoaded(firstTexture, loaded);
        loadRemainingTextures();
      },
      undefined,
      () => {
        handleTextureError(0, firstUrl);
        loadRemainingTextures();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [gl, slideUrls, textures]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasInitialSignalRef.current) {
        hasInitialSignalRef.current = true;
        onLoadedRef.current();
      }
    }, FIRST_TEXTURE_FALLBACK_MS);
    return () => clearTimeout(timeout);
  }, []);
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasAllSignalRef.current) {
        hasAllSignalRef.current = true;
        onAllLoadedRef.current();
      }
    }, ALL_TEXTURES_FALLBACK_MS);
    return () => clearTimeout(timeout);
  }, []);
  useEffect(
    () => () => {
      textures.forEach((texture) => texture.dispose());
    },
    [textures],
  );
  return textures;
}

function useContextLossFallback(onContextLost?: () => void) {
  const { gl } = useThree();
  const onContextLostRef = useRef(onContextLost);
  useEffect(() => {
    onContextLostRef.current = onContextLost;
  }, [onContextLost]);
  useEffect(() => {
    const canvas = gl.domElement;
    let restoreTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleLost = (event: Event) => {
      event.preventDefault();
      Sentry.captureMessage("WebGL context lost", "warning");
      restoreTimeout = setTimeout(() => {
        onContextLostRef.current?.();
      }, CONTEXT_RESTORE_GRACE_MS);
    };
    const handleRestored = () => {
      if (restoreTimeout) clearTimeout(restoreTimeout);
      restoreTimeout = null;
    };
    canvas.addEventListener("webglcontextlost", handleLost);
    canvas.addEventListener("webglcontextrestored", handleRestored);
    return () => {
      if (restoreTimeout) clearTimeout(restoreTimeout);
      canvas.removeEventListener("webglcontextlost", handleLost);
      canvas.removeEventListener("webglcontextrestored", handleRestored);
    };
  }, [gl]);
}

function useNoiseShaderMesh(textures: Texture[]) {
  const { scene } = useThree();
  const meshRef = useRef<Mesh | null>(null);
  const uniforms = useMemo<ShaderUniforms>(() => {
    const initial = textures[0] ?? null;
    return {
      uTime: { value: 0 },
      uResolution: { value: new Vector2(1, 1) },
      uTexture: { value: initial },
      uTextureAspect: { value: 1 },
      uNextTexture: { value: initial },
      uNextTextureAspect: { value: 1 },
      uTransition: { value: 0 },
      uZoom: { value: BASE_ZOOM },
      uNextZoom: { value: BASE_ZOOM },
      uMouse: { value: new Vector2(0.5, 0.5) },
    };
  }, [textures]);
  useEffect(() => {
    const geometry = new PlaneGeometry(1, 1);
    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
    });
    const mesh = new Mesh(geometry, material);
    meshRef.current = mesh;
    scene.add(mesh);
    return () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      meshRef.current = null;
    };
  }, [scene, uniforms]);
  return meshRef;
}

interface FrameOptions {
  meshRef: React.RefObject<Mesh | null>;
  textures: Texture[];
  currentIndex: number;
  slideDurationMs: number;
  transitionDurationMs: number;
  reducedMotion: boolean;
  pointerOverride?: PointerOverride;
}

function useNoiseFrame({
  meshRef,
  textures,
  currentIndex,
  slideDurationMs,
  transitionDurationMs,
  reducedMotion,
  pointerOverride,
}: FrameOptions) {
  const { viewport, size } = useThree();
  const isTransitioningRef = useRef(false);
  const zoomRef = useRef({
    currentZoom: BASE_ZOOM,
    nextZoom: BASE_ZOOM,
    currentStartZoom: BASE_ZOOM,
    slideStartTime: 0,
    transitionStartTime: 0,
  });
  const isFirstFrameRef = useRef(true);
  const prevIndexRef = useRef(currentIndex);
  const mouseTarget = useMemo(() => new Vector2(0.5, 0.5), []);
  const transitionSeconds = Math.max(transitionDurationMs / 1000, 0.1);
  const slideSeconds = Math.max(slideDurationMs / 1000, transitionSeconds);
  const zoomSpeed = (reducedMotion ? 0 : ZOOM_TRAVEL) / slideSeconds;
  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const material = mesh.material as ShaderMaterial;
    const uniforms = material.uniforms as ShaderUniforms;
    mesh.scale.set(viewport.width, viewport.height, 1);
    const elapsed = state.clock.elapsedTime;
    if (isFirstFrameRef.current) {
      zoomRef.current.slideStartTime = elapsed;
      isFirstFrameRef.current = false;
    }
    uniforms.uResolution.value.set(size.width, size.height);
    if (reducedMotion) {
      uniforms.uMouse.value.set(0.5, 0.5);
    } else {
      uniforms.uTime.value = elapsed % 1000;
      const override = pointerOverride?.current;
      const px = override
        ? override.x * 0.5 + 0.5
        : state.pointer.x * 0.15 + 0.5;
      const py = override
        ? override.y * 0.5 + 0.5
        : state.pointer.y * 0.15 + 0.5;
      mouseTarget.set(px, py);
      uniforms.uMouse.value.lerp(mouseTarget, 1 - Math.pow(0.95, delta * 60));
    }
    uniforms.uTextureAspect.value = getTextureAspect(uniforms.uTexture.value);
    uniforms.uNextTextureAspect.value = getTextureAspect(
      uniforms.uNextTexture.value,
    );
    const clampedIndex = clampSlideIndex(currentIndex, textures.length);
    if (prevIndexRef.current !== currentIndex) {
      const prevIndex = clampSlideIndex(prevIndexRef.current, textures.length);
      const fromTexture = textures[prevIndex] ?? null;
      const toTexture = textures[clampedIndex] ?? null;
      uniforms.uTexture.value = fromTexture;
      uniforms.uTextureAspect.value = getTextureAspect(fromTexture);
      uniforms.uNextTexture.value = toTexture;
      uniforms.uNextTextureAspect.value = getTextureAspect(toTexture);
      isTransitioningRef.current = true;
      zoomRef.current.currentStartZoom = zoomRef.current.currentZoom;
      zoomRef.current.nextZoom = BASE_ZOOM;
      zoomRef.current.transitionStartTime = elapsed;
      prevIndexRef.current = currentIndex;
    }
    if (isTransitioningRef.current) {
      const transitionElapsed = elapsed - zoomRef.current.transitionStartTime;
      const clampedElapsed = Math.min(transitionElapsed, transitionSeconds);
      const progress = clampedElapsed / transitionSeconds;
      zoomRef.current.currentZoom = Math.min(
        zoomRef.current.currentStartZoom + clampedElapsed * zoomSpeed,
        MAX_ZOOM,
      );
      zoomRef.current.nextZoom = Math.min(
        BASE_ZOOM + clampedElapsed * zoomSpeed,
        MAX_ZOOM,
      );
      uniforms.uTransition.value = progress;
      if (progress >= 1) {
        isTransitioningRef.current = false;
        const settled = textures[clampedIndex] ?? null;
        const settledAspect = getTextureAspect(settled);
        uniforms.uTexture.value = settled;
        uniforms.uTextureAspect.value = settledAspect;
        uniforms.uNextTexture.value = settled;
        uniforms.uNextTextureAspect.value = settledAspect;
        zoomRef.current.currentZoom = zoomRef.current.nextZoom;
        zoomRef.current.currentStartZoom = zoomRef.current.currentZoom;
        zoomRef.current.slideStartTime = elapsed;
        uniforms.uTransition.value = 0;
      }
    } else {
      if (uniforms.uTransition.value !== 0) uniforms.uTransition.value = 0;
      const sinceStart = elapsed - zoomRef.current.slideStartTime;
      zoomRef.current.currentZoom = Math.min(
        zoomRef.current.currentStartZoom + sinceStart * zoomSpeed,
        MAX_ZOOM,
      );
      zoomRef.current.nextZoom = zoomRef.current.currentZoom;
    }
    uniforms.uZoom.value = zoomRef.current.currentZoom;
    uniforms.uNextZoom.value = zoomRef.current.nextZoom;
  });
}

interface NoisePlaneProps {
  slideUrls: string[];
  currentIndex: number;
  slideDurationMs: number;
  transitionDurationMs: number;
  onTextureLoaded: () => void;
  onAllTexturesLoaded: () => void;
  onSlideError?: (index: number) => void;
  onContextLost?: () => void;
  reducedMotion: boolean;
  pointerOverride?: PointerOverride;
}

function NoisePlane({
  slideUrls,
  currentIndex,
  slideDurationMs,
  transitionDurationMs,
  onTextureLoaded,
  onAllTexturesLoaded,
  onSlideError,
  onContextLost,
  reducedMotion,
  pointerOverride,
}: NoisePlaneProps) {
  const textures = useSlideTextures({
    slideUrls,
    onTextureLoaded,
    onAllTexturesLoaded,
    onSlideError,
  });
  useContextLossFallback(onContextLost);
  const meshRef = useNoiseShaderMesh(textures);
  useNoiseFrame({
    meshRef,
    textures,
    currentIndex,
    slideDurationMs,
    transitionDurationMs,
    reducedMotion,
    pointerOverride,
  });
  return null;
}

interface NoiseSceneProps {
  slides: SlideData[];
  currentIndex: number;
  slideDurationMs: number;
  transitionDurationMs: number;
  onTextureLoaded: () => void;
  onAllTexturesLoaded: () => void;
  onSlideError?: (index: number) => void;
  onContextLost?: () => void;
  reducedMotion: boolean;
  pointerOverride?: PointerOverride;
}

export function NoiseScene({
  slides,
  currentIndex,
  slideDurationMs,
  transitionDurationMs,
  onTextureLoaded,
  onAllTexturesLoaded,
  onSlideError,
  onContextLost,
  reducedMotion,
  pointerOverride,
}: NoiseSceneProps) {
  const slideUrls = useMemo(() => slides.map((slide) => slide.url), [slides]);
  return (
    <Canvas
      className="absolute inset-0"
      orthographic
      camera={{ zoom: 1, position: [0, 0, 1] }}
      gl={{
        antialias: false,
        depth: false,
        stencil: false,
        alpha: false,
        powerPreference: "low-power",
      }}
      dpr={1}
    >
      <NoisePlane
        slideUrls={slideUrls}
        currentIndex={currentIndex}
        slideDurationMs={slideDurationMs}
        transitionDurationMs={transitionDurationMs}
        onTextureLoaded={onTextureLoaded}
        onAllTexturesLoaded={onAllTexturesLoaded}
        onSlideError={onSlideError}
        onContextLost={onContextLost}
        reducedMotion={reducedMotion}
        pointerOverride={pointerOverride}
      />
    </Canvas>
  );
}
