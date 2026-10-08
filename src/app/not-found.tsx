import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Страница не найдена",
};

export default function NotFound() {
  return (
    <main className="grain-overlay bg-background p-safe-4 grid min-h-dvh place-items-center">
      <div className="grid w-full max-w-lg gap-4 text-center">
        <h1 className="text-2xl text-white">Страница не найдена</h1>
        <div>
          <Link
            href="/"
            className="inline-block rounded-lg border border-white/30 bg-white/8 px-4 py-2.5 text-white hover:bg-white/15 focus-visible:bg-white/15"
          >
            На главную
          </Link>
        </div>
      </div>
    </main>
  );
}
