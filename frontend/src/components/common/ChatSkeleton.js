"use client";

import SkeletonBlock from "@/components/common/SkeletonBlock";

export default function ChatSkeleton() {
  return (
    <div className="overflow-hidden rounded-[32px] border border-line bg-white shadow-shell">
      <div className="grid min-h-[72vh] lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="border-b border-line bg-canvas/70 p-5 lg:border-b-0 lg:border-r">
          <SkeletonBlock className="h-4 w-24 rounded-full" />
          <SkeletonBlock className="mt-4 h-12 rounded-2xl" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="rounded-[24px] border border-line bg-white px-4 py-4">
                <SkeletonBlock className="h-3 w-28 rounded-full" />
                <SkeletonBlock className="mt-3 h-3 w-20 rounded-full" />
                <SkeletonBlock className="mt-4 h-10 rounded-2xl" />
              </div>
            ))}
          </div>
        </aside>

        <section className="flex flex-col">
          <div className="border-b border-line px-6 py-5">
            <SkeletonBlock className="h-4 w-28 rounded-full" />
            <SkeletonBlock className="mt-4 h-7 w-56 rounded-full" />
            <SkeletonBlock className="mt-3 h-3 w-36 rounded-full" />
          </div>

          <div className="flex-1 space-y-4 bg-[#F8FBFF] px-6 py-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}
              >
                <div className="max-w-[72%] rounded-[28px] bg-white px-4 py-4 shadow-sm">
                  <SkeletonBlock className="h-3 w-32 rounded-full" />
                  <SkeletonBlock className="mt-3 h-3 w-48 rounded-full" />
                  <SkeletonBlock className="mt-3 h-3 w-24 rounded-full" />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-line bg-white px-6 py-5">
            <SkeletonBlock className="h-28 rounded-[24px]" />
            <div className="mt-4 flex gap-3">
              <SkeletonBlock className="h-12 flex-1 rounded-2xl" />
              <SkeletonBlock className="h-12 w-28 rounded-2xl" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
