export default function AuthCard({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <section className="bg-gradient-to-b from-brand-soft/70 to-white px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-9">
        <div className="mb-7">
          <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-dark">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
            </svg>
          </span>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{intro}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
