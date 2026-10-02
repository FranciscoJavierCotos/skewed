"use client";
import { useRouter } from "next/navigation";
import en from "@/messages/en.json";
import { SetupForm } from "./SetupForm";

export default function PlayPage() {
  const router = useRouter();
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">{en.setup.title}</h1>
      <SetupForm onStart={(mode, query) => router.push(`/play/${mode}?${query}`)} />
    </>
  );
}
