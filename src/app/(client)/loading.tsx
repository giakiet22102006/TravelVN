export default function ClientLoading() {
  return (
    <div className="max-w-[1184px] mx-auto px-4 py-10 space-y-6 animate-pulse">
      <div className="h-[180px] rounded-[14px] bg-white border border-border-subtle" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="h-[320px] rounded-[12px] bg-white border border-border-subtle"
          />
        ))}
      </div>
    </div>
  );
}
