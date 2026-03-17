import Link from "next/link";

export default function NotFound() {
  return (
    <main className="bg-background grid min-h-screen place-items-center p-4">
      <div className="grid w-full max-w-lg gap-4 text-center">
        <h1 className="text-2xl text-white">Страница не найдена</h1>
        <p className="text-white/80">Такой страницы не существует.</p>
        <div>
          <Link
            href="/"
            className="inline-block rounded-lg border border-white/30 bg-white/8 px-4 py-2.5 text-white hover:bg-white/15"
          >
            На главную
          </Link>
        </div>
      </div>
    </main>
  );
}
