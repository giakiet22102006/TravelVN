"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Facebook, Instagram, Youtube, Globe } from "lucide-react";
import type { WebsiteInfoData } from "./ClientHeader";

export function ClientFooter({ websiteInfo }: { websiteInfo: WebsiteInfoData }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setFeedback({
        type: "error",
        text: "Vui lòng nhập email của bạn",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/client/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.message || "Đăng ký thất bại, vui lòng thử lại",
        });
      } else {
        setFeedback({
          type: "success",
          text: data.message || "Đăng ký nhận bản tin thành công!",
        });
        setEmail("");
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Không thể kết nối máy chủ, vui lòng thử lại",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <footer
      id="footer-newsletter"
      className="bg-[#ECECEC] rounded-t-[32px] sm:rounded-t-[40px] pt-10 sm:pt-14 pb-24 sm:pb-20 lg:pb-12 mt-14 font-lexend-deca"
    >
      <div className="max-w-[1184px] mx-auto px-4">
        {/* Newsletter Banner Box (#4502C7) */}
        <div className="bg-[#4502C7] rounded-[16px] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-md">
          <div className="lg:max-w-[400px]">
            <h3 className="text-white text-[18px] sm:text-[20px] font-bold leading-snug">
              Đăng ký ngay để không bỏ lỡ các chương trình của chúng tôi
            </h3>
          </div>

          <div className="flex-1 lg:max-w-[640px]">
            <form
              onSubmit={handleSubscribe}
              className="bg-white rounded-[14px] p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email của bạn..."
                aria-label="Nhập email của bạn"
                className="w-full sm:flex-1 h-[44px] min-h-[44px] shrink-0 px-4 rounded-[8px] border border-[#CCD1D2] text-[14px] text-[#25282B] placeholder:text-[#667085] focus:outline-none focus:border-[#4502C7] focus-visible:ring-2 focus-visible:ring-[#4502C7]/40"
              />
              <button
                type="submit"
                disabled={submitting}
                className="h-[44px] px-6 rounded-[8px] bg-[#4502C7] hover:bg-[#36019e] disabled:opacity-60 text-white text-[14px] font-semibold transition-colors whitespace-nowrap"
              >
                {submitting ? "Đang gửi..." : "Đăng Ký Ngay"}
              </button>
            </form>

            {feedback && (
              <p
                className={`mt-2 text-[13px] flex items-center gap-1.5 ${
                  feedback.type === "success" ? "text-emerald-200" : "text-red-200"
                }`}
              >
                {feedback.type === "success" && (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </p>
            )}
          </div>
        </div>

        {/* Middle Links & Social Icons */}
        <div className="py-8 border-b border-[#CCD1D2] flex flex-col md:flex-row items-center justify-between gap-6">
          <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[14px] font-medium text-[#25282B]">
            <Link href="/" className="hover:text-[#4502C7] transition-colors">
              Trang Chủ
            </Link>
            <Link
              href="/tours?category=tour-trong-nuoc"
              className="hover:text-[#4502C7] transition-colors"
            >
              Tour Trong Nước
            </Link>
            <Link
              href="/tours?category=tour-nuoc-ngoai"
              className="hover:text-[#4502C7] transition-colors"
            >
              Tour Nước Ngoài
            </Link>
            <Link
              href="/news"
              className="hover:text-[#4502C7] transition-colors"
            >
              Tin Tức
            </Link>
            <Link
              href="/#footer-newsletter"
              className="hover:text-[#4502C7] transition-colors"
            >
              Liên Hệ
            </Link>
          </nav>

          <div className="flex items-center gap-1.5 text-[#25282B]">
            <a
              href="https://www.facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook VN.TRAVEL"
              className="w-11 h-11 inline-flex items-center justify-center rounded-lg hover:bg-[#4502C7]/10 hover:text-[#4502C7] transition-colors"
            >
              <Facebook className="w-5 h-5" />
            </a>
            <Link
              href="/"
              aria-label="Trang chủ VN.TRAVEL"
              className="w-11 h-11 inline-flex items-center justify-center rounded-lg hover:bg-[#4502C7]/10 hover:text-[#4502C7] transition-colors"
            >
              <Globe className="w-5 h-5" />
            </Link>
            <a
              href="https://www.instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram VN.TRAVEL"
              className="w-11 h-11 inline-flex items-center justify-center rounded-lg hover:bg-[#4502C7]/10 hover:text-[#4502C7] transition-colors"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://www.youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube VN.TRAVEL"
              className="w-11 h-11 inline-flex items-center justify-center rounded-lg hover:bg-[#4502C7]/10 hover:text-[#4502C7] transition-colors"
            >
              <Youtube className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Bottom Copyright Row */}
        <div className="pt-7 flex flex-col md:flex-row items-center justify-between gap-4 text-[13px] text-[#667479]">
          <p className="order-3 md:order-1">
            © 2026 VN.TRAVEL. All rights reserved.
          </p>

          <Link
            href="/"
            className="order-1 md:order-2 text-[24px] font-extrabold tracking-tight text-[#4502C7]"
          >
            {websiteInfo.websiteName || "VN.TRAVEL"}
          </Link>

          <div className="order-2 md:order-3 flex items-center gap-6">
            <Link href="/terms" className="hover:text-[#4502C7]">
              Điều khoản dịch vụ
            </Link>
            <Link href="/privacy" className="hover:text-[#4502C7]">
              Chính sách bảo mật
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
