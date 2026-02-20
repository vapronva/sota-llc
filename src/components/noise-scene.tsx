"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useEffect, useState } from "react";
import type { Mesh, ShaderMaterial, Texture } from "three";
import { TextureLoader, LinearFilter, Vector2 } from "three";

interface TextureUniform {
  value: Texture | null;
}

interface ShaderUniforms {
  uTime: { value: number };
  uResolution: { value: Vector2 };
  uTexture: TextureUniform;
  uTextureAspect: { value: number };
  uNextTexture: TextureUniform;
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

interface NoisePlaneProps {
  slides: SlideData[];
  currentIndex: number;
  onTextureLoaded: () => void;
}

function NoisePlane({
  slides,
  currentIndex,
  onTextureLoaded,
}: NoisePlaneProps) {
  const meshRef = useRef<Mesh>(null);
  const { viewport, size } = useThree();
  const [loadedCount, setLoadedCount] = useState(0);
  const textures = useMemo(() => {
    const loader = new TextureLoader();
    loader.crossOrigin = "anonymous";
    return slides.map((slide) => {
      const tex = loader.load(
        slide.url,
        (t) => {
          t.userData.aspect = t.image.width / t.image.height;
          setLoadedCount((c) => c + 1);
        },
        undefined,
        () => {
          setLoadedCount((c) => c + 1);
        },
      );
      tex.minFilter = LinearFilter;
      tex.magFilter = LinearFilter;
      tex.userData = { aspect: 1 };
      return tex;
    });
  }, [slides]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      onTextureLoaded();
    }, 3000);
    return () => clearTimeout(timeout);
  }, [onTextureLoaded]);
  useEffect(() => {
    if (loadedCount >= 1) {
      onTextureLoaded();
    }
  }, [loadedCount, onTextureLoaded]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new Vector2(size.width, size.height) },
      uTexture: { value: textures[0] },
      uTextureAspect: { value: 1 },
      uNextTexture: { value: textures[1] ?? textures[0] },
      uNextTextureAspect: { value: 1 },
      uTransition: { value: 0 },
      uZoom: { value: 1.0 },
      uNextZoom: { value: 1.0 },
    }),
    [textures, size.width, size.height],
  );
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const fragmentShader = `
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
  const prevIndexRef = useRef(currentIndex);
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as ShaderMaterial;
    const shaderUniforms = material.uniforms as unknown as ShaderUniforms;
    const elapsed = state.clock.elapsedTime;
    if (isFirstFrameRef.current) {
      zoomRef.current.slideStartTime = elapsed;
      isFirstFrameRef.current = false;
    }
    shaderUniforms.uTime.value = elapsed;
    shaderUniforms.uResolution.value.set(size.width, size.height);
    const currentTex = shaderUniforms.uTexture.value;
    const nextTex = shaderUniforms.uNextTexture.value;
    if (currentTex?.userData) {
      shaderUniforms.uTextureAspect.value =
        (currentTex.userData.aspect as number | undefined) ?? 1;
    }
    if (nextTex?.userData) {
      shaderUniforms.uNextTextureAspect.value =
        (nextTex.userData.aspect as number | undefined) ?? 1;
    }
    const zoomSpeed = 0.06 / 15;
    const transitionDurationSeconds = 250 / 60;
    const transitionProgressPerSecond = 1 / transitionDurationSeconds;
    if (prevIndexRef.current !== currentIndex) {
      const prevIndex = prevIndexRef.current;
      shaderUniforms.uTexture.value = textures[prevIndex] ?? null;
      shaderUniforms.uNextTexture.value = textures[currentIndex] ?? null;
      transitionRef.current = { progress: 0, transitioning: true };
      zoomRef.current.currentStartZoom = zoomRef.current.currentZoom;
      zoomRef.current.nextStartZoom = 1.0;
      zoomRef.current.nextZoom = 1.0;
      zoomRef.current.transitionStartTime = elapsed;
      prevIndexRef.current = currentIndex;
    }
    if (transitionRef.current.transitioning) {
      const nextProgress = Math.min(
        transitionRef.current.progress + delta * transitionProgressPerSecond,
        1,
      );
      transitionRef.current.progress = nextProgress;
      const transitionElapsed = elapsed - zoomRef.current.transitionStartTime;
      const clampedTransitionElapsed = Math.min(
        transitionElapsed,
        transitionDurationSeconds,
      );
      zoomRef.current.currentZoom =
        zoomRef.current.currentStartZoom + clampedTransitionElapsed * zoomSpeed;
      zoomRef.current.nextZoom = zoomRef.current.nextStartZoom;
      shaderUniforms.uTransition.value = nextProgress;
      if (nextProgress >= 1) {
        transitionRef.current = { progress: 0, transitioning: false };
        shaderUniforms.uTexture.value = textures[currentIndex] ?? null;
        zoomRef.current.currentZoom = 1.0;
        zoomRef.current.currentStartZoom = 1.0;
        zoomRef.current.nextStartZoom = 1.0;
        zoomRef.current.nextZoom = 1.0;
        zoomRef.current.slideStartTime = elapsed;
      }
    } else {
      shaderUniforms.uTransition.value = 0;
      const timeSinceSlideStart = elapsed - zoomRef.current.slideStartTime;
      zoomRef.current.currentZoom =
        zoomRef.current.currentStartZoom + timeSinceSlideStart * zoomSpeed;
    }
    shaderUniforms.uZoom.value = zoomRef.current.currentZoom;
    shaderUniforms.uNextZoom.value = zoomRef.current.nextZoom;
  });

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}

interface NoiseSceneProps {
  slides: SlideData[];
  currentIndex: number;
  onTextureLoaded: () => void;
}

export function NoiseScene({
  slides,
  currentIndex,
  onTextureLoaded,
}: NoiseSceneProps) {
  return (
    <Canvas
      className="absolute inset-0"
      orthographic
      camera={{ zoom: 1, position: [0, 0, 1] }}
      gl={{ antialias: false }}
    >
      <NoisePlane
        slides={slides}
        currentIndex={currentIndex}
        onTextureLoaded={onTextureLoaded}
      />
    </Canvas>
  );
}
