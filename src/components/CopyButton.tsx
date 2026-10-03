'use client';
import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded border border-line px-2 py-0.5 font-mono text-[0.7rem] text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? 'copied' : 'copy'}
    </button>
  );
}
