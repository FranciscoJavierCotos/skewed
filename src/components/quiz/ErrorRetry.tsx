import en from "@/messages/en.json";

export function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded border border-rose-300 bg-rose-50 p-3 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="rounded bg-rose-600 px-3 py-1 text-white">{en.game.retry}</button>
    </div>
  );
}
