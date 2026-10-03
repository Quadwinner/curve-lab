export function BoltIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="currentColor">
      <path d="M9.2 1 3 9.1h4.2L6.6 15 13 6.6H8.7L9.2 1Z" />
    </svg>
  );
}

export function ArrowIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
