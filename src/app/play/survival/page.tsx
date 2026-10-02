"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { parseSessionConfig, toSearchParams } from "@/engine/session-config";
import en from "@/messages/en.json";
import { SurvivalGame } from "./SurvivalGame";

function Inner() {
  const config = parseSessionConfig("survival", new URLSearchParams(useSearchParams()));
  if (!config) return <p>{en.game.badConfig} <Link className="underline" href="/play">{en.game.changeSetup}</Link></p>;
  // The key forces a fresh run (new reducer state and session id) on "Go to level N+1",
  // which is a client-side navigation to this same route.
  return <SurvivalGame key={toSearchParams(config)} config={config} />;
}

export default function Page() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
