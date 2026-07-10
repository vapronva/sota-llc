"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react";

import { NoiseScene, type SlideData } from "~/components/noise-scene";
import { WebGLErrorBoundary } from "~/components/webgl-fallback";
import slidesData from "~/data/slides.json";
import { useDeviceOrientation } from "~/hooks/use-device-orientation";

const slides: SlideData[] = slidesData;

const SLIDE_DURATION = 7500;
const TRANSITION_DURATION = 3500;
const CREDIT_TRANSITION_DURATION = 2000;

type SlideshowState = {
  currentIndex: number;
  isLoaded: boolean;
  displayedCredit: SlideData;
  creditVisible: boolean;
  webglFailed: boolean;
  failedSlides: number[];
};

type SlideshowAction =
  | { type: "texturesReady" }
  | { type: "advance" }
  | { type: "creditSettled" }
  | { type: "slideFailed"; index: number }
  | { type: "webglFailed" };

const initialState: SlideshowState = {
  currentIndex: 0,
  isLoaded: false,
  displayedCredit: slides[0]!,
  creditVisible: true,
  webglFailed: false,
  failedSlides: [],
};

function nextLoadableIndex(current: number, failedSlides: number[]): number {
  for (let step = 1; step <= slides.length; step++) {
    const candidate = (current + step) % slides.length;
    if (!failedSlides.includes(candidate)) return candidate;
  }
  return current;
}

function slideshowReducer(
  state: SlideshowState,
  action: SlideshowAction,
): SlideshowState {
  switch (action.type) {
    case "texturesReady":
      return state.isLoaded ? state : { ...state, isLoaded: true };
    case "advance": {
      const nextIndex = nextLoadableIndex(
        state.currentIndex,
        state.failedSlides,
      );
      if (nextIndex === state.currentIndex) return state;
      return { ...state, currentIndex: nextIndex, creditVisible: false };
    }
    case "creditSettled":
      return {
        ...state,
        displayedCredit: slides[state.currentIndex] ?? state.displayedCredit,
        creditVisible: true,
      };
    case "slideFailed":
      return state.failedSlides.includes(action.index)
        ? state
        : { ...state, failedSlides: [...state.failedSlides, action.index] };
    case "webglFailed":
      return {
        ...state,
        webglFailed: true,
        displayedCredit: slides[state.currentIndex] ?? state.displayedCredit,
        creditVisible: true,
      };
  }
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

let reducedMotionMql: MediaQueryList | undefined;
const getReducedMotionMql = () =>
  (reducedMotionMql ??= window.matchMedia(reducedMotionQuery));

function subscribeReducedMotion(onChange: () => void) {
  const mql = getReducedMotionMql();
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

const getReducedMotionSnapshot = () => getReducedMotionMql().matches;

const getReducedMotionServer = () => false;

let webglSupportCache: boolean | null = null;

const subscribeWebGLSupport = () => () => undefined;

const getWebGLSupportSnapshot = (): boolean | null => {
  if (webglSupportCache !== null) return webglSupportCache;
  try {
    const canvas = document.createElement("canvas");
    webglSupportCache = Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") ?? canvas.getContext("webgl")),
    );
  } catch {
    webglSupportCache = false;
  }
  return webglSupportCache;
};

const getWebGLSupportServer = (): boolean | null => null;

export default function HomeClient({ currentYear }: { currentYear: number }) {
  const [state, dispatch] = useReducer(slideshowReducer, initialState);
  const {
    currentIndex,
    isLoaded,
    displayedCredit,
    creditVisible,
    webglFailed,
  } = state;
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServer,
  );
  const webglSupported = useSyncExternalStore(
    subscribeWebGLSupport,
    getWebGLSupportSnapshot,
    getWebGLSupportServer,
  );
  const orientation = useDeviceOrientation();
  const creditTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideshowIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const allTexturesLoadedRef = useRef(false);
  const reducedMotionRef = useRef(reducedMotion);
  const teardownSlideshow = useCallback(() => {
    if (slideshowIntervalRef.current) {
      clearInterval(slideshowIntervalRef.current);
      slideshowIntervalRef.current = null;
    }
    if (creditTimeoutRef.current) {
      clearTimeout(creditTimeoutRef.current);
      creditTimeoutRef.current = null;
    }
  }, []);
  const startSlideshow = useCallback(() => {
    if (
      slideshowIntervalRef.current ||
      slides.length <= 1 ||
      reducedMotionRef.current
    ) {
      return;
    }
    slideshowIntervalRef.current = setInterval(() => {
      dispatch({ type: "advance" });
      if (creditTimeoutRef.current) clearTimeout(creditTimeoutRef.current);
      creditTimeoutRef.current = setTimeout(() => {
        dispatch({ type: "creditSettled" });
      }, CREDIT_TRANSITION_DURATION / 2);
    }, SLIDE_DURATION);
  }, []);
  const handleTextureLoaded = useCallback(
    () => dispatch({ type: "texturesReady" }),
    [],
  );
  const handleAllTexturesLoaded = useCallback(() => {
    allTexturesLoadedRef.current = true;
    startSlideshow();
  }, [startSlideshow]);
  const handleSlideError = useCallback(
    (index: number) => dispatch({ type: "slideFailed", index }),
    [],
  );
  const handleWebglError = useCallback(() => {
    teardownSlideshow();
    allTexturesLoadedRef.current = false;
    dispatch({ type: "webglFailed" });
  }, [teardownSlideshow]);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    if (reducedMotion) {
      teardownSlideshow();
      const rafId = requestAnimationFrame(() => {
        dispatch({ type: "creditSettled" });
      });
      return () => cancelAnimationFrame(rafId);
    }
    if (allTexturesLoadedRef.current) {
      startSlideshow();
    }
  }, [reducedMotion, startSlideshow, teardownSlideshow]);
  useEffect(() => teardownSlideshow, [teardownSlideshow]);
  const inFallback = webglFailed || webglSupported === false;
  const revealed = isLoaded || inFallback;
  const webglFallback = <div className="grain-overlay absolute inset-0" />;
  return (
    <main className="bg-background fixed inset-0 touch-pinch-zoom overflow-hidden">
      <noscript>
        <style>{`[data-reveal] { opacity: 1 !important; }`}</style>
      </noscript>
      <div
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-1000 ${revealed ? "opacity-100" : "opacity-0"}`}
      >
        {inFallback ? (
          webglFallback
        ) : webglSupported ? (
          <WebGLErrorBoundary
            fallback={webglFallback}
            onError={handleWebglError}
          >
            <NoiseScene
              slides={slides}
              currentIndex={currentIndex}
              slideDurationMs={SLIDE_DURATION}
              transitionDurationMs={TRANSITION_DURATION}
              onTextureLoaded={handleTextureLoaded}
              onAllTexturesLoaded={handleAllTexturesLoaded}
              onSlideError={handleSlideError}
              onContextLost={handleWebglError}
              reducedMotion={reducedMotion}
              pointerOverride={
                orientation.isSupported ? orientation.positionRef : undefined
              }
            />
          </WebGLErrorBoundary>
        ) : null}
      </div>
      <div
        data-reveal
        className={`pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 transition-opacity delay-300 duration-1000 md:p-6 lg:p-8 ${revealed ? "opacity-100" : "opacity-0"}`}
      >
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
          <a
            href={displayedCredit.creditLink}
            target="_blank"
            rel="noopener noreferrer"
            lang="en"
            aria-live="polite"
            className={`pointer-events-auto -m-2 transform-gpu p-2 text-[10px] text-white/50 transition-[opacity,visibility] duration-1000 backface-hidden hover:text-white/80 focus-visible:text-white/80 md:text-xs ${creditVisible ? "visible opacity-100" : "invisible opacity-0"}`}
          >
            {displayedCredit.credit}
          </a>
        </div>
      </div>
    </main>
  );
}
