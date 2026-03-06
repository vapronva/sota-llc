"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useEffect, useState } from "react";
import type { Mesh, Texture } from "three";
import { TextureLoader, LinearFilter, Vector2 } from "three";

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
  varying vec2 vUv;
  vec3 processImage(sampler2D tex, vec2 uv, float zoom, float texAspect) {
    float screenAspect = uResolution.x / uResolution.y;
    vec2 scale = vec2(1.0);
    if (screenAspect > texAspect) {
      scale.y = texAspect / screenAspect;
    } else {
      scale.x = screenAspect / texAspect;
    }
    vec2 zoomedUv = (uv - 0.5) * scale / zoom + 0.5;
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

interface NoisePlaneProps {
  slidesContentKey: string;
  slideCount: number;
  currentIndex: number;
  slideDurationMs: number;
  transitionDurationMs: number;
  onTextureLoaded: () => void;
  onAllTexturesLoaded: () => void;
}

function NoisePlane({
  slidesContentKey,
  slideCount,
  currentIndex,
  slideDurationMs,
  transitionDurationMs,
  onTextureLoaded,
  onAllTexturesLoaded,
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
    batchToken: slidesContentKey,
    count: 0,
  }));
  const loadedCount =
    loadProgress.batchToken === slidesContentKey ? loadProgress.count : 0;
  const prevIndexRef = useRef(currentIndex);
  const hasInitialLoadSignalRef = useRef(false);
  const hasAllLoadedSignalRef = useRef(false);
  useEffect(() => {
    hasInitialLoadSignalRef.current = false;
    hasAllLoadedSignalRef.current = false;
  }, [slidesContentKey]);
  const textures = useMemo(() => {
    const loader = new TextureLoader();
    const renderer = gl as typeof gl & {
      initTexture?: (texture: Texture) => void;
    };
    const batchKey = slidesContentKey;
    const incrementLoadedCount = () => {
      setLoadProgress((progress) => {
        if (progress.batchToken === batchKey) {
          return { batchToken: progress.batchToken, count: progress.count + 1 };
        }
        return { batchToken: batchKey, count: 1 };
      });
    };
    const slideUrls: string[] = JSON.parse(slidesContentKey) as string[];
    loader.crossOrigin = "anonymous";
    return slideUrls.map((url) => {
      const tex = loader.load(
        url,
        (t) => {
          t.userData.aspect = t.image.width / t.image.height;
          try {
            renderer.initTexture?.(t);
          } catch {}
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
      tex.userData = { aspect: 1 };
      return tex;
    });
  }, [gl, slidesContentKey]);
  useEffect(() => {
    if (loadedCount >= 1 && !hasInitialLoadSignalRef.current) {
      hasInitialLoadSignalRef.current = true;
      onTextureLoadedRef.current();
    }
  }, [loadedCount]);
  useEffect(() => {
    if (slideCount === 0) {
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
    if (loadedCount >= slideCount && !hasAllLoadedSignalRef.current) {
      hasAllLoadedSignalRef.current = true;
      onAllTexturesLoadedRef.current();
    }
  }, [loadedCount, slideCount]);
  useEffect(() => {
    if (slideCount === 0 || hasInitialLoadSignalRef.current) {
      return;
    }
    const timeout = setTimeout(() => {
      if (!hasInitialLoadSignalRef.current) {
        hasInitialLoadSignalRef.current = true;
        onTextureLoadedRef.current();
      }
    }, 3000);
    return () => {
      clearTimeout(timeout);
    };
  }, [slidesContentKey, slideCount]);
  useEffect(() => {
    if (slideCount === 0 || hasAllLoadedSignalRef.current) {
      return;
    }
    const timeout = setTimeout(() => {
      if (!hasAllLoadedSignalRef.current) {
        hasAllLoadedSignalRef.current = true;
        onAllTexturesLoadedRef.current();
      }
    }, 10_000);
    return () => {
      clearTimeout(timeout);
    };
  }, [slidesContentKey, slideCount]);
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
    const nextTexture =
      textures.length > 1 ? (textures[1] ?? initialTexture) : initialTexture;
    const u: ShaderUniforms = {
      uTime: { value: 0 },
      uResolution: { value: new Vector2(1, 1) },
      uTexture: { value: initialTexture },
      uTextureAspect: { value: 1 },
      uNextTexture: { value: nextTexture },
      uNextTextureAspect: { value: 1 },
      uTransition: { value: 0 },
      uZoom: { value: 1.0 },
      uNextZoom: { value: 1.0 },
    };
    return u;
  }, [textures]);
  useEffect(() => {
    uniformsRef.current = uniforms;
  }, [uniforms]);
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
  const targetZoomPerSlide = 1.08;
  const zoomSpeed = (targetZoomPerSlide - 1) / slideDurationSeconds;
  useFrame((state) => {
    const u = uniformsRef.current;
    if (!meshRef.current || !u) return;
    const elapsed = state.clock.elapsedTime;
    if (isFirstFrameRef.current) {
      zoomRef.current.slideStartTime = elapsed;
      isFirstFrameRef.current = false;
    }
    u.uTime.value = elapsed;
    u.uResolution.value.set(size.width, size.height);
    const currentTex = u.uTexture.value;
    const nextTex = u.uNextTexture.value;
    if (currentTex?.userData) {
      u.uTextureAspect.value =
        (currentTex.userData.aspect as number | undefined) ?? 1;
    }
    if (nextTex?.userData) {
      u.uNextTextureAspect.value =
        (nextTex.userData.aspect as number | undefined) ?? 1;
    }
    const clampedIndex =
      textures.length > 0
        ? Math.max(0, Math.min(currentIndex, textures.length - 1))
        : 0;
    if (prevIndexRef.current !== currentIndex) {
      const prevIndex =
        textures.length > 0
          ? Math.max(0, Math.min(prevIndexRef.current, textures.length - 1))
          : 0;
      u.uTexture.value = textures[prevIndex] ?? null;
      u.uNextTexture.value = textures[clampedIndex] ?? null;
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
        u.uTexture.value = textures[clampedIndex] ?? null;
        const nextTextureIndex =
          textures.length > 0 ? (clampedIndex + 1) % textures.length : 0;
        u.uNextTexture.value = textures[nextTextureIndex] ?? u.uTexture.value;
        zoomRef.current.currentZoom = zoomRef.current.nextZoom;
        zoomRef.current.currentStartZoom = zoomRef.current.currentZoom;
        zoomRef.current.nextStartZoom = zoomRef.current.currentZoom;
        zoomRef.current.nextZoom = zoomRef.current.currentZoom;
        zoomRef.current.slideStartTime = elapsed;
        u.uTransition.value = 0;
      }
    } else {
      u.uTransition.value = 0;
      const timeSinceSlideStart = elapsed - zoomRef.current.slideStartTime;
      zoomRef.current.currentZoom =
        zoomRef.current.currentStartZoom + timeSinceSlideStart * zoomSpeed;
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
  slideDurationMs?: number;
  transitionDurationMs?: number;
  onTextureLoaded: () => void;
  onAllTexturesLoaded: () => void;
}

export function NoiseScene({
  slides,
  currentIndex,
  slideDurationMs = 7500,
  transitionDurationMs = 3000,
  onTextureLoaded,
  onAllTexturesLoaded,
}: NoiseSceneProps) {
  const slidesContentKey = useMemo(
    () => JSON.stringify(slides.map((slide) => slide.url)),
    [slides],
  );
  return (
    <Canvas
      className="absolute inset-0"
      orthographic
      camera={{ zoom: 1, position: [0, 0, 1] }}
      gl={{ antialias: false }}
      dpr={1}
    >
      <NoisePlane
        key={slidesContentKey}
        slidesContentKey={slidesContentKey}
        slideCount={slides.length}
        currentIndex={currentIndex}
        slideDurationMs={slideDurationMs}
        transitionDurationMs={transitionDurationMs}
        onTextureLoaded={onTextureLoaded}
        onAllTexturesLoaded={onAllTexturesLoaded}
      />
    </Canvas>
  );
}
