import Link from "next/link";
import type { Mode } from "@/domain/types";
import en from "@/messages/en.json";

const MODES: Mode[] = ["practice", "exam", "survival"];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-16">
      <section className="flex flex-col items-start gap-4">
        <h1 className="text-4xl font-bold tracking-tight">{en.app.name}</h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">{en.app.tagline}</p>
        <p className="text-sm text-neutral-500">{en.landing.levels}</p>
        <Link href="/play" className="rounded-lg bg-sky-600 px-5 py-3 font-semibold text-white hover:bg-sky-700">
          {en.landing.cta}
        </Link>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {MODES.map((m) => (
          <div key={m} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <h2 className="font-semibold">{en.setup.modes[m].name}</h2>
            <p className="text-sm text-neutral-500">{en.setup.modes[m].desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
