"use client";

import { useState, useEffect, useRef } from "react";

import { NoiseScene, type SlideData } from "~/components/noise-scene";

const slides: SlideData[] = [
  {
    url: "https://cdn.engineering/hidetohyde/pixiv/130823834_p1.jpg",
    credit: 'Background art: "Le soleil de ma vie" by Hyde on Pixiv',
    creditLink: "https://www.pixiv.net/en/artworks/130823834",
  },
  {
    url: "https://cdn.engineering/sota-llc/barkiplier.jpg",
    credit: "Background Markiplier: Cream (dog) on Instagram",
    creditLink: "https://www.instagram.com/p/DChUskEyZff",
  },
  {
    url: "https://cdn.engineering/hidetohyde/pixiv/125578456_p0.jpg",
    credit: 'Background art: "「なんだジロジロ見やがって」" by Hyde on Pixiv',
    creditLink: "https://www.pixiv.net/en/artworks/125578456",
  },
  {
    url: "https://cdn.engineering/hidetohyde/pixiv/116695137_p0.jpg",
    credit: 'Background art: "コン" by Hyde on Pixiv',
    creditLink: "https://www.pixiv.net/en/artworks/116695137",
  },
];

const SLIDE_DURATION = 7500;
const CREDIT_TRANSITION_DURATION = 2000;

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [displayedCredit, setDisplayedCredit] = useState(slides[0]!);
  const [creditVisible, setCreditVisible] = useState(true);
  const prevIndexRef = useRef(currentIndex);
  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % slides.length);
    }, SLIDE_DURATION);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (prevIndexRef.current !== currentIndex) {
      setCreditVisible(false);
      prevIndexRef.current = currentIndex;
      const timeout = setTimeout(() => {
        setDisplayedCredit(slides[currentIndex]!);
        setCreditVisible(true);
      }, CREDIT_TRANSITION_DURATION / 2);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex]);
  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#0a0a0a]">
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}
      >
        <NoiseScene
          slides={slides}
          currentIndex={currentIndex}
          onTextureLoaded={() => setIsLoaded(true)}
        />
      </div>
      <div
        className={`pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 transition-opacity delay-300 duration-1000 md:p-6 lg:p-8 ${isLoaded ? "opacity-100" : "opacity-0"}`}
      >
        <div className="space-y-2">
          <h1 className="text-5xl tracking-tighter text-white md:text-7xl lg:text-8xl">
            SOTA
          </h1>
          <p className="max-w-md text-sm tracking-wide text-white/70 md:text-base lg:text-lg">
            Мы SOTA... потому что мы SOTA.
          </p>
        </div>

        <div className="flex flex-col items-start gap-1 md:flex-row md:items-end md:justify-between">
          <span className="text-xs text-white/30">
            sota.llc · {new Date().getFullYear()}
          </span>
          <a
            href={displayedCredit.creditLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`pointer-events-auto transform-gpu text-[10px] text-white/15 transition-opacity duration-1000 backface-hidden hover:text-white/30 md:text-xs ${creditVisible ? "opacity-100" : "opacity-0"}`}
          >
            {displayedCredit.credit}
          </a>
        </div>
      </div>
    </main>
  );
}
