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
};

type SlideshowAction =
  | { type: "texturesReady" }
  | { type: "transitionStart"; nextIndex: number }
  | { type: "creditSettled"; credit: SlideData }
  | { type: "webglFailed" };

const initialState: SlideshowState = {
  currentIndex: 0,
  isLoaded: false,
  displayedCredit: slides[0]!,
  creditVisible: true,
  webglFailed: false,
};

function slideshowReducer(
  state: SlideshowState,
  action: SlideshowAction,
): SlideshowState {
  switch (action.type) {
    case "texturesReady":
      return state.isLoaded ? state : { ...state, isLoaded: true };
    case "transitionStart":
      return {
        ...state,
        currentIndex: action.nextIndex,
        creditVisible: false,
      };
    case "creditSettled":
      return {
        ...state,
        displayedCredit: action.credit,
        creditVisible: true,
      };
    case "webglFailed":
      return { ...state, webglFailed: true };
  }
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mql = window.matchMedia(reducedMotionQuery);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

const getReducedMotionSnapshot = () =>
  window.matchMedia(reducedMotionQuery).matches;

const getReducedMotionServer = () => false;

let webglSupportCache: boolean | null = null;

const subscribeWebGLSupport = () => () => undefined;

const getWebGLSupportSnapshot = (): boolean | null => {
  if (webglSupportCache === null) {
    try {
      const canvas = document.createElement("canvas");
      webglSupportCache = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") ?? canvas.getContext("webgl"))
      );
    } catch {
      webglSupportCache = false;
    }
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
  const currentIndexRef = useRef(0);
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
      const nextIndex = (currentIndexRef.current + 1) % slides.length;
      currentIndexRef.current = nextIndex;
      dispatch({ type: "transitionStart", nextIndex });
      if (creditTimeoutRef.current) clearTimeout(creditTimeoutRef.current);
      creditTimeoutRef.current = setTimeout(() => {
        dispatch({ type: "creditSettled", credit: slides[nextIndex]! });
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
        dispatch({
          type: "creditSettled",
          credit: slides[currentIndexRef.current]!,
        });
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
  const webglFallback = <div className="bg-background absolute inset-0" />;
  return (
    <main className="bg-background fixed inset-0 touch-none overflow-hidden">
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
              reducedMotion={reducedMotion}
              pointerOverride={
                orientation.supported
                  ? { x: orientation.x, y: orientation.y }
                  : undefined
              }
            />
          </WebGLErrorBoundary>
        ) : null}
      </div>
      <div
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
          <span className="text-xs text-white/30">
            sota.llc · {currentYear}
          </span>
          {!inFallback && (
            <a
              href={displayedCredit.creditLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`pointer-events-auto transform-gpu text-[10px] text-white/15 transition-opacity duration-1000 backface-hidden hover:text-white/30 md:text-xs ${creditVisible ? "opacity-100" : "opacity-0"}`}
            >
              {displayedCredit.credit}
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
