import Link from "next/link";
import en from "@/messages/en.json";

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <nav aria-label="Main" className="mx-auto flex max-w-3xl items-center gap-6 p-4">
        <Link href="/" className="mr-auto text-lg font-bold">{en.app.name}</Link>
        <Link href="/play" className="hover:underline">{en.nav.play}</Link>
        <Link href="/about" className="hover:underline">{en.nav.about}</Link>
      </nav>
    </header>
  );
}
