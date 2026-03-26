export default function TopicHubLoading() {
  return (
    <section className="full-bleed relative -mt-8 overflow-hidden bg-carnival-ink py-16 text-white md:py-20">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-32 -top-24 h-96 w-96 rounded-full bg-carnival-red/25 blur-[120px]" />
        <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-carnival-gold/20 blur-[100px]" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4">
        <div className="max-w-3xl animate-pulse space-y-4">
          <div className="h-5 w-40 rounded-full bg-white/20" />
          <div className="h-12 w-full max-w-2xl rounded-md bg-white/20" />
          <div className="h-5 w-full max-w-xl rounded-md bg-white/15" />
          <div className="h-5 w-11/12 max-w-2xl rounded-md bg-white/15" />
          <div className="flex gap-3 pt-2">
            <div className="h-11 w-52 rounded-full bg-white/20" />
            <div className="h-11 w-56 rounded-full bg-white/15" />
          </div>
        </div>
      </div>
    </section>
  );
}
