// Homepage loading skeleton: shown while the server components behind
// the homepage (hero, trending, activity, explore) stream in. Pure
// placeholder blocks — no data, no fake content.
export default function Loading() {
  const shimmer =
    "animate-pulse rounded-2xl bg-gradient-to-br from-brand-soft via-white to-brand-soft";
  return (
    <div
      aria-hidden="true"
      className="relative left-1/2 w-screen -translate-x-1/2"
    >
      <div className="-mt-10">
        <div className="h-[300px] w-full animate-pulse bg-gradient-to-br from-brand-soft via-white to-brand-soft md:h-[330px]" />
      </div>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="flex flex-col gap-10 py-10 md:gap-12">
          <section>
            <div className="h-7 w-56 animate-pulse rounded-lg bg-brand-soft" />
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className={`h-64 ${shimmer}`} />
              <div className={`hidden h-64 ${shimmer} md:block`} />
              <div className={`hidden h-64 ${shimmer} md:block`} />
            </div>
          </section>
          <section>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`h-[76px] ${shimmer}`} />
                ))}
              </div>
              <div className={`h-64 ${shimmer}`} />
              <div className="grid grid-cols-3 gap-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`h-36 ${shimmer}`} />
                ))}
              </div>
            </div>
          </section>
          <section>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`h-80 ${shimmer}`} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
