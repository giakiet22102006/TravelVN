import Link from "next/link";

export default function GlobalNotFoundPage() {
  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-border-subtle p-10 sm:p-14 max-w-lg w-full text-center shadow-sm">
        <div className="text-7xl sm:text-8xl font-black tracking-tight text-client-primary select-none">
          404
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink mt-4">
          Trang này không tồn tại...
        </h1>
        <p className="text-sm text-ink-muted mt-2">
          Rất tiếc, nội dung bạn tìm kiếm không khả dụng hoặc đường dẫn đã thay đổi.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="h-11 px-6 rounded-xl bg-client-accent hover:bg-client-accent-hover text-white text-sm font-bold inline-flex items-center justify-center transition-colors"
          >
            Về trang chủ
          </Link>
          <Link
            href="/tours"
            className="h-11 px-6 rounded-xl border border-client-border hover:border-client-primary text-ink text-sm font-bold inline-flex items-center justify-center transition-colors"
          >
            Khám phá tour
          </Link>
        </div>
      </div>
    </div>
  );
}
