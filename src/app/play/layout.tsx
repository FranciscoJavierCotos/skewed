import type { Metadata } from "next";
import { GameServicesProvider } from "@/game/services";

export const metadata: Metadata = { title: "Play — Skewed" };

export default function PlayLayout({ children }: LayoutProps<"/play">) {
  return (
    <GameServicesProvider>
      <main className="mx-auto w-full max-w-3xl p-4">{children}</main>
    </GameServicesProvider>
  );
}
