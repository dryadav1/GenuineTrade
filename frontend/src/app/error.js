"use client";

import Link from "next/link";

export default function Error({ reset }) {
  return (
    <main className="min-h-screen bg-canvas px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <section className="panel rounded-[32px] p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/55">
            GenuineTrade
          </p>
          <h1 className="mt-4 text-4xl font-bold text-ink sm:text-5xl">
            Something interrupted this workspace.
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted sm:text-base">
            We kept the platform from crashing the whole session. You can retry this screen or jump
            back to a stable route.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button className="btn-primary" onClick={() => reset()} type="button">
              Try again
            </button>
            <Link href="/" className="btn-secondary">
              Back home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
