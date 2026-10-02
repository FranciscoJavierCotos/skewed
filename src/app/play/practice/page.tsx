"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { parseSessionConfig } from "@/engine/session-config";
import en from "@/messages/en.json";
import { PracticeGame } from "./PracticeGame";

function Inner() {
  const config = parseSessionConfig("practice", new URLSearchParams(useSearchParams()));
  if (!config) return <p>{en.game.badConfig} <Link className="underline" href="/play">{en.game.changeSetup}</Link></p>;
  return <PracticeGame config={config} />;
}

export default function Page() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
