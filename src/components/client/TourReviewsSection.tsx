"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Loader2,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useClientMeta } from "@/components/client/ClientLayoutShell";
import { formatDateVN } from "@/lib/format";
import type { TourAiReviewSummary } from "@/lib/ai";
import type { RatingBreakdownMap, TourReviewItem } from "@/lib/client-data";

export interface TourReviewsStats {
  ratingAvg: number;
  reviewCount: number;
  ratingBreakdown: RatingBreakdownMap;
  aiReviewSummary: TourAiReviewSummary | null;
}

interface TourReviewsSectionProps {
  tourId: string;
  tourSlug: string;
  tourName: string;
  initialStats: TourReviewsStats;
  initialReviews: TourReviewItem[];
  onStatsChange?: (next: { ratingAvg: number; reviewCount: number }) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: "Rất tệ",
  2: "Chưa hài lòng",
  3: "Bình thường",
  4: "Hài lòng",
  5: "Tuyệt vời",
};

const SENTIMENT_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  POSITIVE: {
    label: "Tích cực",
    className: "bg-status-success-bg text-status-success border-status-success-border",
  },
  NEUTRAL: {
    label: "Trung lập",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  NEGATIVE: {
    label: "Cần cải thiện",
    className: "bg-status-warn-bg text-status-warn border-status-warn-border",
  },
};

export function TourReviewsSection({
  tourSlug,
  tourName,
  initialStats,
  initialReviews,
  onStatsChange,
}: TourReviewsSectionProps) {
  const { currentUser } = useClientMeta();

  const [reviews, setReviews] = useState<TourReviewItem[]>(initialReviews);
  const [stats, setStats] = useState<TourReviewsStats>(initialStats);
  const [ratingFilter, setRatingFilter] = useState<string>("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});

  const [isVerifiedBooking, setIsVerifiedBooking] = useState(false);
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setReviews(initialReviews);
    setStats(initialStats);
  }, [tourSlug, initialReviews, initialStats]);

  // Fetch viewer booking badge state when user is logged in
  useEffect(() => {
    if (!currentUser) {
      setIsVerifiedBooking(false);
      return;
    }

    let cancelled = false;
    async function checkViewerBooking() {
      try {
        const res = await fetch(
          `/api/client/tours/${encodeURIComponent(tourSlug)}/reviews?limit=1`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.viewerState) {
          setIsVerifiedBooking(Boolean(data.viewerState.isVerifiedBooking));
        }
      } catch {
        // Ignore transient network errors
      }
    }

    checkViewerBooking();
    return () => {
      cancelled = true;
    };
  }, [currentUser, tourSlug]);

  async function applyFilter(nextRating: string, nextVerified: boolean) {
    setRatingFilter(nextRating);
    setVerifiedOnly(nextVerified);
    setLoadingList(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (nextRating) {
        params.set("rating", nextRating);
      }
      if (nextVerified) {
        params.set("verified", "true");
      }

      const res = await fetch(
        `/api/client/tours/${encodeURIComponent(tourSlug)}/reviews?${params.toString()}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.reviews)) {
        setReviews(data.reviews);
      }
      if (data.stats) {
        setStats(data.stats);
      }
    } finally {
      setLoadingList(false);
    }
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    const trimmed = commentInput.trim();
    if (trimmed.length < 10) {
      setFeedback({
        type: "error",
        text: "Vui lòng viết tối thiểu 10 ký tự để chia sẻ trải nghiệm thực tế của bạn.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/client/tours/${encodeURIComponent(tourSlug)}/reviews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rating: ratingInput,
            comment: trimmed,
          }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          type: "error",
          text:
            data.message || "Không thể đăng đánh giá lúc này. Vui lòng thử lại.",
        });
        return;
      }

      setCommentInput("");
      setRatingInput(5);
      setFeedback({
        type: "success",
        text: data.message || "Cảm ơn bạn! Đánh giá đã được hiển thị ngay.",
      });

      if (data.stats) {
        setStats(data.stats);
        onStatsChange?.({
          ratingAvg: data.stats.ratingAvg,
          reviewCount: data.stats.reviewCount,
        });
      }

      // Reset filter to all so user sees their newly published review immediately
      if (ratingFilter !== "" || verifiedOnly) {
        await applyFilter("", false);
      } else if (data.review) {
        setReviews((prev) => [data.review, ...prev]);
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Lỗi kết nối máy chủ. Vui lòng thử lại.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const aiSummary = stats.aiReviewSummary;
  const activeStars = hoverRating || ratingInput;

  const breakdownRows = useMemo(() => {
    const total = Math.max(1, stats.reviewCount);
    return ([5, 4, 3, 2, 1] as const).map((star) => {
      const count = stats.ratingBreakdown?.[star] ?? 0;
      const pct = stats.reviewCount > 0 ? Math.round((count / total) * 100) : 0;
      return { star, count, pct };
    });
  }, [stats]);

  return (
    <section
      id="tour-reviews"
      className="mt-10 bg-white rounded-[14px] p-5 sm:p-7 border border-border-subtle shadow-sm font-lexend-deca"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-[22px] sm:text-[24px] font-bold text-ink flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-client-primary" />
            <span>Đánh Giá &amp; Bình Luận Khách Hàng</span>
          </h2>
          <p className="text-[13px] text-ink-muted mt-1">
            Phản hồi thực tế về hành trình {tourName}
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-client-soft border border-client-border text-client-primary text-[12px] font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Tích hợp AI Tóm tắt &amp; Kiểm duyệt</span>
        </div>
      </div>

      {/* Top Grid: Overall Score + AI Review Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-7">
        {/* Rating Overview */}
        <div className="lg:col-span-5 rounded-[12px] bg-surface-page border border-border-subtle p-5">
          <div className="flex items-center gap-4 pb-4 border-b border-border-subtle">
            <div className="text-center min-w-[92px]">
              <div className="text-[32px] font-extrabold text-client-primary leading-none tabular-nums">
                {stats.reviewCount > 0 ? stats.ratingAvg.toFixed(1) : "—"}
              </div>
              <div className="text-[12px] text-ink-muted mt-1">
                {stats.reviewCount > 0 ? "trên 5 sao" : "Chưa có điểm"}
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      stats.reviewCount > 0 && i < Math.round(stats.ratingAvg)
                        ? "fill-client-star text-client-star"
                        : "text-border-strong"
                    }`}
                  />
                ))}
              </div>
              <p className="text-[13px] font-semibold text-ink mt-1 tabular-nums">
                {stats.reviewCount > 0
                  ? `${stats.reviewCount} đánh giá thực tế`
                  : "Chưa có đánh giá nào"}
              </p>
              <p className="text-[12px] text-ink-muted">
                Khách đã đặt tour được gắn huy hiệu xác thực
              </p>
            </div>
          </div>

          <div className="pt-4 space-y-2">
            {breakdownRows.map((row) => {
              const starStr = String(row.star);
              return (
              <button
                key={row.star}
                type="button"
                onClick={() =>
                  applyFilter(ratingFilter === starStr ? "" : starStr, verifiedOnly)
                }
                className={`w-full flex items-center gap-2.5 text-[12px] py-0.5 rounded hover:bg-white/70 transition-colors tabular-nums ${
                  ratingFilter === starStr ? "font-bold text-client-primary" : "text-ink-muted"
                }`}
              >
                <span className="w-11 text-left inline-flex items-center gap-1">
                  {row.star}
                  <Star className="w-3 h-3 fill-client-star text-client-star" />
                </span>
                <div className="flex-1 h-2 bg-surface-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-client-star rounded-full transition-[width] duration-300"
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
                <span className="w-8 text-right font-semibold tabular-nums">{row.count}</span>
              </button>
              );
            })}
          </div>
        </div>

        {/* AI Review Summary Card */}
        <div className="lg:col-span-7 rounded-[12px] bg-gradient-to-br from-client-soft via-white to-surface-page border border-client-border p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="inline-flex items-center gap-2 text-ink font-bold text-[15px]">
                <span className="w-7 h-7 rounded-lg bg-client-primary text-white inline-flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span>AI Tóm Tắt Đánh Giá Khách Hàng</span>
              </div>
              {aiSummary && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white border border-client-border text-client-primary">
                  {aiSummary.source === "gemini"
                    ? "Gemini AI"
                    : "Smart NLP Summary"}
                </span>
              )}
            </div>

            {aiSummary ? (
              <div className="space-y-3">
                <p className="text-[13px] sm:text-[14px] text-ink leading-relaxed font-medium">
                  {aiSummary.overview}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {aiSummary.pros.length > 0 && (
                    <div className="rounded-[10px] bg-status-success-bg/80 border border-status-success-border p-3">
                      <p className="text-[12px] font-bold text-status-success inline-flex items-center gap-1.5 mb-1.5">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Ưu điểm nổi bật</span>
                      </p>
                      <ul className="space-y-1 text-[12px] text-status-success list-disc pl-4">
                        {aiSummary.pros.map((pro, idx) => (
                          <li key={idx}>{pro}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiSummary.cons.length > 0 && (
                    <div className="rounded-[10px] bg-status-warn-bg/80 border border-status-warn-border p-3">
                      <p className="text-[12px] font-bold text-status-warn inline-flex items-center gap-1.5 mb-1.5">
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span>Điểm cần lưu ý</span>
                      </p>
                      <ul className="space-y-1 text-[12px] text-status-warn list-disc pl-4">
                        {aiSummary.cons.map((con, idx) => (
                          <li key={idx}>{con}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {aiSummary.tips && (
                  <div className="rounded-[8px] bg-white/90 border border-client-border px-3 py-2 text-[12px] text-ink-muted flex items-start gap-1.5">
                    <Lightbulb className="w-4 h-4 shrink-0 text-client-primary mt-0.5" />
                    <div>
                      <span className="font-bold text-client-primary">Mẹo từ AI: </span>
                      {aiSummary.tips}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-ink-muted leading-relaxed">
                Tour này chưa có đánh giá nào. Hãy là người đầu tiên chia sẻ trải
                nghiệm để hệ thống AI tổng hợp góc nhìn khách quan cho những du
                khách tiếp theo!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Write a Review Form */}
      <div className="rounded-[12px] border border-border-subtle bg-surface-page p-4 sm:p-5 mb-7">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-[16px] font-bold text-ink">
            Viết đánh giá &amp; bình luận của bạn
          </h3>
          <span className="text-[12px] text-client-primary inline-flex items-center gap-1 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>AI kiểm duyệt văn minh • Hiển thị ngay</span>
          </span>
        </div>

        {!currentUser ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[10px] bg-white border border-border-subtle p-4">
            <div>
              <p className="text-[14px] font-semibold text-ink">
                Đăng nhập để chia sẻ cảm nhận về tour
              </p>
              <p className="text-[12px] text-ink-muted mt-0.5">
                Hỗ trợ đăng nhập nhanh 1 chạm bằng Google hoặc tài khoản khách
                hàng VN.TRAVEL.
              </p>
            </div>
            <Link
              href={`/login?next=${encodeURIComponent(`/tours/${tourSlug}#tour-reviews`)}`}
              className="shrink-0 h-[40px] px-5 rounded-[8px] bg-client-primary hover:bg-client-primary-hover text-white text-[13px] font-semibold inline-flex items-center justify-center transition-colors"
            >
              Đăng nhập ngay
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmitReview} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-ink-muted">
                  Chọn mức hài lòng:
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      aria-label={`Chấm ${star} sao`}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRatingInput(star)}
                      className="p-0.5 transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= activeStars
                            ? "fill-client-star text-client-star"
                            : "text-border-strong"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-[13px] font-bold text-client-primary">
                  {RATING_LABELS[activeStars]}
                </span>
              </div>

              {isVerifiedBooking && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-success-bg border border-status-success-border text-status-success text-[12px] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Bạn đã đặt tour này (Huy hiệu xác thực)</span>
                </span>
              )}
            </div>

            <textarea
              rows={3}
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Chia sẻ trải nghiệm về lịch trình, hướng dẫn viên, khách sạn, bữa ăn... (tối thiểu 10 ký tự)"
              maxLength={1500}
              className="w-full rounded-[10px] border border-border-strong bg-white px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-client-primary focus-visible:ring-2 focus-visible:ring-client-primary/30"
            />

            {feedback && (
              <div
                className={`rounded-[8px] px-3.5 py-2.5 text-[13px] font-medium flex items-start gap-2 ${
                  feedback.type === "success"
                    ? "bg-status-success-bg text-status-success border border-status-success-border"
                    : "bg-status-danger-bg text-status-danger border border-status-danger-border"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[12px] text-ink-muted">
                Đang bình luận với tên:{" "}
                <strong className="text-ink">
                  {currentUser.fullName}
                </strong>
              </span>
              <button
                type="submit"
                disabled={submitting}
                className="h-[40px] px-5 rounded-[8px] bg-client-primary hover:bg-client-primary-hover disabled:opacity-60 text-white text-[13px] font-semibold inline-flex items-center gap-2 transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang kiểm duyệt &amp; đăng...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Gửi Đánh Giá Ngay</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {[
          { label: "Tất cả", rating: "" },
          { label: "5 Sao", rating: "5" },
          { label: "4 Sao", rating: "4" },
          { label: "3 Sao", rating: "3" },
          { label: "1–2 Sao", rating: "1,2" },
        ].map((pill) => {
          const active = ratingFilter === pill.rating && !verifiedOnly;
          return (
            <button
              key={pill.label}
              type="button"
              onClick={() => applyFilter(pill.rating, false)}
              className={`h-[34px] px-3.5 rounded-full text-[12px] font-semibold border tabular-nums transition-colors ${
                active
                  ? "bg-client-primary text-white border-client-primary"
                  : "bg-white text-ink-muted border-border-strong hover:border-client-primary hover:text-client-primary"
              }`}
            >
              {pill.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => applyFilter("", !verifiedOnly)}
          className={`h-[34px] px-3.5 rounded-full text-[12px] font-semibold border inline-flex items-center gap-1.5 transition-colors ${
            verifiedOnly
              ? "bg-client-primary text-white border-client-primary"
              : "bg-white text-client-primary border-client-border hover:bg-client-soft"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Đã trải nghiệm tour</span>
        </button>
      </div>

      {/* Reviews Feed */}
      {loadingList ? (
        <div className="py-10 text-center text-[13px] text-ink-muted inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="w-4 h-4 animate-spin text-client-primary" />
          <span>Đang tải danh sách đánh giá...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-10 text-center rounded-[10px] border border-dashed border-border-strong text-[13px] text-ink-muted">
          Không có đánh giá nào khớp bộ lọc hiện tại.
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => {
            const sentimentInfo =
              SENTIMENT_BADGE[rev.aiSentiment] ?? SENTIMENT_BADGE.POSITIVE;

            return (
              <article
                key={rev.id}
                className="rounded-[12px] border border-border-subtle bg-white p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-client-soft text-client-primary font-bold flex items-center justify-center shrink-0">
                      {rev.user.avatar && !failedAvatars[rev.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={rev.user.avatar}
                          alt={rev.user.fullName}
                          onError={() =>
                            setFailedAvatars((prev) => ({ ...prev, [rev.id]: true }))
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        rev.user.fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-bold text-ink">
                          {rev.user.fullName}
                        </span>
                        {rev.isVerifiedBooking && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-status-success-bg border border-status-success-border text-status-success text-[11px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đã trải nghiệm tour</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center text-client-star">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < rev.rating
                                  ? "fill-client-star"
                                  : "text-border-strong"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] text-ink-muted tabular-nums">
                          {formatDateVN(rev.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${sentimentInfo.className}`}
                  >
                    {sentimentInfo.label}
                  </span>
                </div>

                <p className="mt-3 text-[14px] text-ink leading-relaxed whitespace-pre-line">
                  {rev.comment}
                </p>

                {rev.adminReply && (
                  <div className="mt-3 ml-2 sm:ml-6 rounded-[10px] bg-client-soft/70 border border-client-border p-3.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[12px] font-bold text-client-primary">
                        Phản hồi từ VN.TRAVEL
                      </span>
                      {rev.repliedAt && (
                        <span className="text-[11px] text-ink-muted tabular-nums">
                          {formatDateVN(rev.repliedAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-ink leading-relaxed whitespace-pre-line">
                      {rev.adminReply}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
