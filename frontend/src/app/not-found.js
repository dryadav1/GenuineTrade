import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <section className="panel rounded-[32px] p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/55">
            404
          </p>
          <h1 className="mt-4 text-4xl font-bold text-ink sm:text-5xl">
            This page is not part of the trade flow.
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted sm:text-base">
            The route may have moved during the production cleanup. Use the main navigation to jump
            back into a valid GenuineTrade workspace.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="btn-primary">
              Go home
            </Link>
            <Link href="/pricing" className="btn-secondary">
              View pricing
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
