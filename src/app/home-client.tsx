"use client";

import * as Sentry from "@sentry/nextjs";
import dynamic from "next/dynamic";
import {
  type ActionDispatch,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import slides from "~/data/slides.json";
import { useDeviceOrientation } from "~/hooks/use-device-orientation";

const NoiseScene = dynamic(
  () => import("~/components/noise-scene").then((module) => module.NoiseScene),
  { ssr: false },
);

const SLIDE_DURATION_MS = 7_500;
const TRANSITION_DURATION_MS = 3_500;
const FIRST_SLIDE_GRACE_MS = 3_000;

type SlideImage =
  | { kind: "pending" }
  | { kind: "loaded"; image: HTMLImageElement }
  | { kind: "failed" };

interface SlideshowState {
  images: SlideImage[];
  currentIndex: number | null;
  creditIndex: number | null;
  isFirstSlideOverdue: boolean;
  isWebglLost: boolean;
}

type SlideshowAction =
  | { kind: "imageLoaded"; index: number; image: HTMLImageElement }
  | { kind: "imageFailed"; index: number }
  | { kind: "advanced" }
  | { kind: "creditSettled" }
  | { kind: "firstSlideOverdue" }
  | { kind: "webglLost" };

const initialState: SlideshowState = {
  images: slides.map(() => ({ kind: "pending" })),
  currentIndex: null,
  creditIndex: null,
  isFirstSlideOverdue: false,
  isWebglLost: false,
};

function replaceImage(images: SlideImage[], index: number, image: SlideImage) {
  return images.map((current, i) => (i === index ? image : current));
}

function findNextLoadedIndex(images: SlideImage[], fromIndex: number) {
  for (let step = 1; step < images.length; step++) {
    const index = (fromIndex + step) % images.length;
    if (images[index]?.kind === "loaded") return index;
  }
  return null;
}

function slideshowReducer(
  state: SlideshowState,
  action: SlideshowAction,
): SlideshowState {
  switch (action.kind) {
    case "imageLoaded": {
      const images = replaceImage(state.images, action.index, {
        kind: "loaded",
        image: action.image,
      });
      if (state.currentIndex !== null) return { ...state, images };
      return {
        ...state,
        images,
        currentIndex: action.index,
        creditIndex: action.index,
      };
    }
    case "imageFailed":
      return {
        ...state,
        images: replaceImage(state.images, action.index, { kind: "failed" }),
      };
    case "advanced": {
      if (state.currentIndex === null) return state;
      const nextIndex = findNextLoadedIndex(state.images, state.currentIndex);
      return nextIndex === null ? state : { ...state, currentIndex: nextIndex };
    }
    case "creditSettled":
      return { ...state, creditIndex: state.currentIndex };
    case "firstSlideOverdue":
      return { ...state, isFirstSlideOverdue: true };
    case "webglLost":
      return { ...state, isWebglLost: true };
  }
}

function listSlidesToLoad({
  images,
  isFirstSlideOverdue,
  isReducedMotion,
}: {
  images: SlideImage[];
  isFirstSlideOverdue: boolean;
  isReducedMotion: boolean;
}) {
  if (isReducedMotion) {
    const index = images.findIndex((image) => image.kind !== "failed");
    return index === -1 ? [] : [index];
  }
  if (images[0]?.kind === "pending" && !isFirstSlideOverdue) return [0];
  return images.map((_, index) => index);
}

function loadSlideImage(url: string) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  return image.decode().then(() => image);
}

let reducedMotionQuery: MediaQueryList | undefined;
const getReducedMotionQuery = () =>
  (reducedMotionQuery ??= window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ));

function subscribeReducedMotion(onChange: () => void) {
  const query = getReducedMotionQuery();
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => getReducedMotionQuery().matches,
    () => false,
  );
}

let webglSupportCache: boolean | undefined;

function detectWebglSupport() {
  try {
    const context = document.createElement("canvas").getContext("webgl2");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return context !== null;
  } catch {
    return false;
  }
}

const subscribeNever = () => () => undefined;

function useWebglSupport() {
  return useSyncExternalStore(
    subscribeNever,
    () => (webglSupportCache ??= detectWebglSupport()),
    () => null,
  );
}

function useSlideLoading({
  images,
  isFirstSlideOverdue,
  isReducedMotion,
  isEnabled,
  dispatch,
}: {
  images: SlideImage[];
  isFirstSlideOverdue: boolean;
  isReducedMotion: boolean;
  isEnabled: boolean;
  dispatch: ActionDispatch<[SlideshowAction]>;
}) {
  const requestedSlidesRef = useRef(new Set<number>());
  useEffect(() => {
    if (!isEnabled) return;
    const indexesToLoad = listSlidesToLoad({
      images,
      isFirstSlideOverdue,
      isReducedMotion,
    });
    const requested = requestedSlidesRef.current;
    slides.forEach(({ url }, index) => {
      if (!indexesToLoad.includes(index) || requested.has(index)) return;
      requested.add(index);
      loadSlideImage(url).then(
        (image) => dispatch({ kind: "imageLoaded", index, image }),
        () => {
          Sentry.captureMessage("Failed to load slide image", {
            level: "error",
            extra: { url },
          });
          dispatch({ kind: "imageFailed", index });
        },
      );
    });
  }, [images, isFirstSlideOverdue, isReducedMotion, isEnabled, dispatch]);
  useEffect(() => {
    if (!isEnabled) return;
    const timeout = setTimeout(
      () => dispatch({ kind: "firstSlideOverdue" }),
      FIRST_SLIDE_GRACE_MS,
    );
    return () => clearTimeout(timeout);
  }, [isEnabled, dispatch]);
}

export default function HomeClient({ currentYear }: { currentYear: number }) {
  const [state, dispatch] = useReducer(slideshowReducer, initialState);
  const { images, currentIndex, creditIndex, isFirstSlideOverdue } = state;
  const isReducedMotion = useIsReducedMotion();
  const webglSupport = useWebglSupport();
  const [isCreditHovered, setIsCreditHovered] = useState(false);
  const [isCreditFocused, setIsCreditFocused] = useState(false);
  const isSceneEnabled =
    webglSupport === true &&
    !state.isWebglLost &&
    images.some((image) => image.kind !== "failed");
  const isFallback = webglSupport !== null && !isSceneEnabled;
  const tiltRef = useDeviceOrientation(isSceneEnabled && !isReducedMotion);
  const loadedImages = useMemo(
    () =>
      images.flatMap((image) => (image.kind === "loaded" ? image.image : [])),
    [images],
  );
  const currentSlide = currentIndex === null ? undefined : images[currentIndex];
  const currentImage =
    currentSlide?.kind === "loaded" ? currentSlide.image : undefined;
  const canAdvance =
    isSceneEnabled &&
    !isReducedMotion &&
    !isCreditHovered &&
    !isCreditFocused &&
    currentIndex !== null &&
    findNextLoadedIndex(images, currentIndex) !== null;
  const credit = slides[creditIndex ?? 0];
  const isCreditVisible =
    isSceneEnabled && creditIndex !== null && creditIndex === currentIndex;
  useSlideLoading({
    images,
    isFirstSlideOverdue,
    isReducedMotion,
    isEnabled: isSceneEnabled,
    dispatch,
  });
  useEffect(() => {
    if (!canAdvance) return;
    const timeout = setTimeout(
      () => dispatch({ kind: "advanced" }),
      SLIDE_DURATION_MS,
    );
    return () => clearTimeout(timeout);
  }, [canAdvance, currentIndex]);
  useEffect(() => {
    if (creditIndex === currentIndex) return;
    const timeout = setTimeout(
      () => dispatch({ kind: "creditSettled" }),
      isReducedMotion ? 0 : TRANSITION_DURATION_MS / 2,
    );
    return () => clearTimeout(timeout);
  }, [creditIndex, currentIndex, isReducedMotion]);
  return (
    <main className="bg-background fixed inset-0 touch-pinch-zoom overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0">
        {isFallback ? (
          <div className="grain-overlay animate-fade-in absolute inset-0" />
        ) : null}
        {isSceneEnabled ? (
          <Sentry.ErrorBoundary onError={() => dispatch({ kind: "webglLost" })}>
            <NoiseScene
              images={loadedImages}
              currentImage={currentImage}
              slideDurationMs={SLIDE_DURATION_MS}
              transitionDurationMs={TRANSITION_DURATION_MS}
              isReducedMotion={isReducedMotion}
              tiltRef={tiltRef}
              onContextLost={() => dispatch({ kind: "webglLost" })}
            />
          </Sentry.ErrorBoundary>
        ) : null}
      </div>
      <div className="p-safe-4 md:p-safe-6 lg:p-safe-8 animate-fade-in pointer-events-none absolute inset-0 z-10 flex flex-col justify-between">
        <div className="space-y-2">
          <h1 className="text-5xl tracking-tighter text-white md:text-7xl lg:text-8xl">
            SOTA
          </h1>
          <p className="max-w-md text-sm tracking-wide text-white/70 md:text-base lg:text-lg">
            Мы SOTA… потому что мы SOTA.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 md:flex-row md:items-end md:justify-between">
          <span className="text-xs text-white/50">
            sota.llc · {currentYear}
          </span>
          {credit ? (
            <a
              href={credit.creditLink}
              target="_blank"
              rel="noopener noreferrer"
              lang="en"
              onPointerEnter={() => setIsCreditHovered(true)}
              onPointerLeave={() => setIsCreditHovered(false)}
              onFocus={() => setIsCreditFocused(true)}
              onBlur={() => setIsCreditFocused(false)}
              style={{ transitionDuration: `${TRANSITION_DURATION_MS / 2}ms` }}
              className={`pointer-events-auto -m-2 transform-gpu p-2 text-[10px] text-white/50 transition-[opacity,visibility] backface-hidden hover:text-white/80 focus-visible:text-white/80 md:text-xs ${isCreditVisible ? "visible opacity-100" : "invisible opacity-0"}`}
            >
              {credit.credit}
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}
