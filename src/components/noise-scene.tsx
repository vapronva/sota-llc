"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useEffect, useState } from "react";
import type { Mesh, Texture } from "three";
import { TextureLoader, LinearFilter, Vector2 } from "three";

const FIRST_TEXTURE_FALLBACK_MS = 3_000;
const ALL_TEXTURES_FALLBACK_MS = 10_000;

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
    vec2 parallaxOffset = (uMouse - 0.5) * 0.015;
    vec2 zoomedUv = (uv - 0.5) * scale / zoom + 0.5 + parallaxOffset;
    vec4 bgColor = texture2D(tex, zoomedUv);
    vec3 darkBg = bgColor.rgb * 0.15;
    darkBg = pow(darkBg, vec3(1.4));
    darkBg = darkBg * 0.7;
    darkBg = clamp(darkBg, 0.0, 0.15);
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
    float x = (uv.x + 4.0) * (uv.y + 4.0) * (uTime * 10.0);
    float grain = (mod((mod(x, 13.0) + 1.0) * (mod(x, 123.0) + 1.0), 0.01) - 0.005) * strength;
    vec3 finalColor = darkBg + vec3(grain);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function getTextureAspect(texture: Texture | null): number {
  return (texture?.userData?.aspect as number | undefined) ?? 1;
}

interface NoisePlaneProps {
  slideUrls: string[];
  slidesKey: string;
  currentIndex: number;
  slideDurationMs: number;
  transitionDurationMs: number;
  onTextureLoaded: () => void;
  onAllTexturesLoaded: () => void;
  reducedMotion: boolean;
}

function NoisePlane({
  slideUrls,
  slidesKey,
  currentIndex,
  slideDurationMs,
  transitionDurationMs,
  onTextureLoaded,
  onAllTexturesLoaded,
  reducedMotion,
}: NoisePlaneProps) {
  const meshRef = useRef<Mesh>(null);
  const uniformsRef = useRef<ShaderUniforms | null>(null);
  const { viewport, size, gl } = useThree();
  const onTextureLoadedRef = useRef(onTextureLoaded);
  const onAllTexturesLoadedRef = useRef(onAllTexturesLoaded);
  useEffect(() => {
    onTextureLoadedRef.current = onTextureLoaded;
    onAllTexturesLoadedRef.current = onAllTexturesLoaded;
  }, [onTextureLoaded, onAllTexturesLoaded]);
  const [loadProgress, setLoadProgress] = useState(() => ({
    batchToken: slidesKey,
    count: 0,
  }));
  const loadedCount =
    loadProgress.batchToken === slidesKey ? loadProgress.count : 0;
  const prevIndexRef = useRef(currentIndex);
  const hasInitialLoadSignalRef = useRef(false);
  const hasAllLoadedSignalRef = useRef(false);
  useEffect(() => {
    hasInitialLoadSignalRef.current = false;
    hasAllLoadedSignalRef.current = false;
  }, [slidesKey]);
  const textures = useMemo(() => {
    const loader = new TextureLoader();
    const renderer = gl as typeof gl & {
      initTexture?: (texture: Texture) => void;
    };
    const batchKey = slidesKey;
    const incrementLoadedCount = () => {
      setLoadProgress((progress) => {
        if (progress.batchToken === batchKey) {
          return { batchToken: progress.batchToken, count: progress.count + 1 };
        }
        return { batchToken: batchKey, count: 1 };
      });
    };
    loader.crossOrigin = "anonymous";
    return slideUrls.map((url) => {
      const tex = loader.load(
        url,
        (t) => {
          t.userData.aspect = t.image.width / t.image.height;
          try {
            renderer.initTexture?.(t);
          } catch (err) {
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                "[NoiseScene] renderer.initTexture failed",
                { url, textureId: t.id, renderer: renderer.constructor.name },
                err,
              );
            }
          }
          incrementLoadedCount();
        },
        undefined,
        (error) => {
          console.error("Failed to load slide texture", { url, error });
          incrementLoadedCount();
        },
      );
      tex.minFilter = LinearFilter;
      tex.magFilter = LinearFilter;
      tex.userData.aspect ??= 1;
      return tex;
    });
  }, [gl, slidesKey, slideUrls]);
  useEffect(() => {
    if (loadedCount >= 1 && !hasInitialLoadSignalRef.current) {
      hasInitialLoadSignalRef.current = true;
      onTextureLoadedRef.current();
    }
  }, [loadedCount]);
  useEffect(() => {
    if (slideUrls.length === 0) {
      if (!hasInitialLoadSignalRef.current) {
        hasInitialLoadSignalRef.current = true;
        onTextureLoadedRef.current();
      }
      if (!hasAllLoadedSignalRef.current) {
        hasAllLoadedSignalRef.current = true;
        onAllTexturesLoadedRef.current();
      }
      return;
    }
    if (loadedCount >= slideUrls.length && !hasAllLoadedSignalRef.current) {
      hasAllLoadedSignalRef.current = true;
      onAllTexturesLoadedRef.current();
    }
  }, [loadedCount, slideUrls.length]);
  useEffect(() => {
    if (slideUrls.length === 0 || hasInitialLoadSignalRef.current) {
      return;
    }
    const timeout = setTimeout(() => {
      if (!hasInitialLoadSignalRef.current) {
        hasInitialLoadSignalRef.current = true;
        onTextureLoadedRef.current();
      }
    }, FIRST_TEXTURE_FALLBACK_MS);
    return () => {
      clearTimeout(timeout);
    };
  }, [slidesKey, slideUrls.length]);
  useEffect(() => {
    if (slideUrls.length === 0 || hasAllLoadedSignalRef.current) {
      return;
    }
    const timeout = setTimeout(() => {
      if (!hasAllLoadedSignalRef.current) {
        hasAllLoadedSignalRef.current = true;
        onAllTexturesLoadedRef.current();
      }
    }, ALL_TEXTURES_FALLBACK_MS);
    return () => {
      clearTimeout(timeout);
    };
  }, [slidesKey, slideUrls.length]);
  useEffect(
    () => () => {
      textures.forEach((texture) => {
        texture.dispose();
      });
    },
    [textures],
  );
  const uniforms = useMemo(() => {
    const initialTexture = textures[0] ?? null;
    const u: ShaderUniforms = {
      uTime: { value: 0 },
      uResolution: { value: new Vector2(1, 1) },
      uTexture: { value: initialTexture },
      uTextureAspect: { value: 1 },
      uNextTexture: { value: initialTexture },
      uNextTextureAspect: { value: 1 },
      uTransition: { value: 0 },
      uZoom: { value: 1.0 },
      uNextZoom: { value: 1.0 },
      uMouse: { value: new Vector2(0.5, 0.5) },
    };
    return u;
  }, [textures]);
  useEffect(() => {
    uniformsRef.current = uniforms;
  }, [uniforms]);
  useEffect(() => {
    const u = uniformsRef.current;
    if (u) u.uResolution.value.set(size.width, size.height);
  }, [size.width, size.height]);
  const transitionRef = useRef({ progress: 0, transitioning: false });
  const zoomRef = useRef({
    currentZoom: 1.0,
    nextZoom: 1.0,
    currentStartZoom: 1.0,
    nextStartZoom: 1.0,
    slideStartTime: 0,
    transitionStartTime: 0,
  });
  const isFirstFrameRef = useRef(true);
  const transitionDurationSeconds = Math.max(transitionDurationMs / 1000, 0.1);
  const slideDurationSeconds = Math.max(
    slideDurationMs / 1000,
    transitionDurationSeconds,
  );
  const targetZoomPerSlide = reducedMotion ? 1.0 : 1.08;
  const zoomSpeed = (targetZoomPerSlide - 1) / slideDurationSeconds;
  const mouseTarget = useMemo(() => new Vector2(0.5, 0.5), []);
  useFrame((state) => {
    const u = uniformsRef.current;
    if (!meshRef.current || !u) return;
    const elapsed = state.clock.elapsedTime;
    if (isFirstFrameRef.current) {
      zoomRef.current.slideStartTime = elapsed;
      isFirstFrameRef.current = false;
    }
    u.uTime.value = elapsed;
    if (!reducedMotion) {
      mouseTarget.set(state.pointer.x * 0.5 + 0.5, state.pointer.y * 0.5 + 0.5);
      u.uMouse.value.lerp(mouseTarget, 0.05);
    }
    const currentTex = u.uTexture.value;
    const nextTex = u.uNextTexture.value;
    u.uTextureAspect.value = getTextureAspect(currentTex);
    u.uNextTextureAspect.value = getTextureAspect(nextTex);
    const clampedIndex =
      textures.length > 0
        ? Math.max(0, Math.min(currentIndex, textures.length - 1))
        : 0;
    if (prevIndexRef.current !== currentIndex) {
      const prevIndex =
        textures.length > 0
          ? Math.max(0, Math.min(prevIndexRef.current, textures.length - 1))
          : 0;
      const fromTexture = textures[prevIndex] ?? null;
      const toTexture = textures[clampedIndex] ?? null;
      u.uTexture.value = fromTexture;
      u.uTextureAspect.value = getTextureAspect(fromTexture);
      u.uNextTexture.value = toTexture;
      u.uNextTextureAspect.value = getTextureAspect(toTexture);
      transitionRef.current = { progress: 0, transitioning: true };
      zoomRef.current.currentStartZoom = zoomRef.current.currentZoom;
      zoomRef.current.nextStartZoom = 1.0;
      zoomRef.current.nextZoom = 1.0;
      zoomRef.current.transitionStartTime = elapsed;
      prevIndexRef.current = currentIndex;
    }
    if (transitionRef.current.transitioning) {
      const transitionElapsed = elapsed - zoomRef.current.transitionStartTime;
      const clampedTransitionElapsed = Math.min(
        transitionElapsed,
        transitionDurationSeconds,
      );
      const nextProgress = Math.min(
        clampedTransitionElapsed / transitionDurationSeconds,
        1,
      );
      transitionRef.current.progress = nextProgress;
      zoomRef.current.currentZoom =
        zoomRef.current.currentStartZoom + clampedTransitionElapsed * zoomSpeed;
      zoomRef.current.nextZoom =
        zoomRef.current.nextStartZoom + clampedTransitionElapsed * zoomSpeed;
      u.uTransition.value = nextProgress;
      if (nextProgress >= 1) {
        transitionRef.current = { progress: 0, transitioning: false };
        const settledTexture = textures[clampedIndex] ?? null;
        const settledAspect = getTextureAspect(settledTexture);
        u.uTexture.value = settledTexture;
        u.uTextureAspect.value = settledAspect;
        u.uNextTexture.value = settledTexture;
        u.uNextTextureAspect.value = settledAspect;
        zoomRef.current.currentZoom = zoomRef.current.nextZoom;
        zoomRef.current.currentStartZoom = zoomRef.current.currentZoom;
        zoomRef.current.nextStartZoom = zoomRef.current.currentZoom;
        zoomRef.current.nextZoom = zoomRef.current.currentZoom;
        zoomRef.current.slideStartTime = elapsed;
        u.uTransition.value = 0;
      }
    } else {
      if (u.uTransition.value !== 0) u.uTransition.value = 0;
      const timeSinceSlideStart = elapsed - zoomRef.current.slideStartTime;
      zoomRef.current.currentZoom =
        zoomRef.current.currentStartZoom + timeSinceSlideStart * zoomSpeed;
      zoomRef.current.nextZoom = zoomRef.current.currentZoom;
    }
    u.uZoom.value = zoomRef.current.currentZoom;
    u.uNextZoom.value = zoomRef.current.nextZoom;
  });
  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
      />
    </mesh>
  );
}

interface NoiseSceneProps {
  slides: SlideData[];
  currentIndex: number;
  slideDurationMs: number;
  transitionDurationMs: number;
  onTextureLoaded: () => void;
  onAllTexturesLoaded: () => void;
  reducedMotion: boolean;
}

export function NoiseScene({
  slides,
  currentIndex,
  slideDurationMs,
  transitionDurationMs,
  onTextureLoaded,
  onAllTexturesLoaded,
  reducedMotion,
}: NoiseSceneProps) {
  const slideUrls = useMemo(() => slides.map((slide) => slide.url), [slides]);
  const slidesKey = useMemo(() => slideUrls.join("\0"), [slideUrls]);
  return (
    <Canvas
      className="absolute inset-0"
      orthographic
      camera={{ zoom: 1, position: [0, 0, 1] }}
      gl={{ antialias: false }}
      dpr={1}
    >
      <NoisePlane
        key={slidesKey}
        slideUrls={slideUrls}
        slidesKey={slidesKey}
        currentIndex={currentIndex}
        slideDurationMs={slideDurationMs}
        transitionDurationMs={transitionDurationMs}
        onTextureLoaded={onTextureLoaded}
        onAllTexturesLoaded={onAllTexturesLoaded}
        reducedMotion={reducedMotion}
      />
    </Canvas>
  );
}
