"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { parseSessionConfig } from "@/engine/session-config";
import en from "@/messages/en.json";
import { ExamGame } from "./ExamGame";

function Inner() {
  const config = parseSessionConfig("exam", new URLSearchParams(useSearchParams()));
  if (!config) return <p>{en.game.badConfig} <Link className="underline" href="/play">{en.game.changeSetup}</Link></p>;
  return <ExamGame config={config} />;
}

export default function Page() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
