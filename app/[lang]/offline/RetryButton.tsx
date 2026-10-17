"use client";

export default function RetryButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => location.reload()}
      className="rounded-full bg-brand px-10 py-3.5 text-white shadow-lg shadow-brand/30 transition hover:-translate-y-0.5 hover:bg-brand-dark"
    >
      {label}
    </button>
  );
}
