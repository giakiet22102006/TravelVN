"use client";

import React from "react";
import Link from "next/link";
import { Compass, Heart, UserCheck } from "lucide-react";
import { useClientMeta } from "@/components/client/ClientLayoutShell";
import { useWishlist } from "@/components/client/WishlistContext";
import { AccountSidebar } from "@/components/client/AccountSidebar";
import { TourCard } from "@/components/client/TourCard";

export default function WishlistPage() {
  const { currentUser } = useClientMeta();
  const { tours, loading, count } = useWishlist();

  if (!currentUser) {
    return (
      <div className="max-w-[1120px] mx-auto px-4 py-10 space-y-8">
        <div className="max-w-[680px] mx-auto bg-white rounded-[16px] border border-subtle p-8 shadow-sm text-center space-y-4">
          <UserCheck className="w-12 h-12 mx-auto text-client-primary" />
          <h1 className="text-[22px] font-bold text-ink">
            Đăng nhập để đồng bộ Tour Yêu Thích
          </h1>
          <p className="text-[14px] text-ink-muted">
            {count > 0
              ? `Bạn đang có ${count} tour đã lưu trên thiết bị này. Đăng nhập để lưu vĩnh viễn vào tài khoản VN.TRAVEL.`
              : "Lưu lại những hành trình bạn yêu thích để dễ dàng theo dõi giá vé và lịch khởi hành."}
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/login?next=/account/wishlist"
              className="px-6 py-2.5 rounded-[10px] bg-client-primary text-white font-semibold text-[14px] hover:bg-client-primary-hover transition-colors"
            >
              Đăng Nhập
            </Link>
            <Link
              href="/tours"
              className="px-6 py-2.5 rounded-[10px] border border-strong text-ink font-semibold text-[14px] hover:border-client-primary hover:text-client-primary transition-colors"
            >
              Khám phá Tour
            </Link>
          </div>
        </div>

        {tours.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-[20px] font-bold text-ink">
              Tour đã lưu trên trình duyệt ({tours.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {tours.map((tour) => (
                <TourCard key={tour.id} tour={tour} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[1120px] mx-auto px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-[24px] sm:text-[28px] font-bold text-ink inline-flex items-center gap-2.5">
          <Heart className="w-6 h-6 text-client-accent fill-client-accent" />
          <span>Tour Yêu Thích ({tours.length})</span>
        </h1>
        <Link
          href="/tours"
          className="text-[13px] font-semibold text-client-primary hover:underline inline-flex items-center gap-1"
        >
          <Compass className="w-4 h-4" />
          <span>Khám phá thêm tour</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4">
          <AccountSidebar />
        </div>

        <div className="lg:col-span-8">
          {loading && tours.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-[320px] rounded-[12px] bg-surface-muted border border-subtle animate-pulse"
                />
              ))}
            </div>
          ) : tours.length === 0 ? (
            <div className="bg-white rounded-[16px] border border-subtle p-12 text-center shadow-sm">
              <Heart className="w-12 h-12 mx-auto text-ink-muted mb-3" />
              <p className="text-[16px] font-bold text-ink">
                Danh sách yêu thích đang trống
              </p>
              <p className="text-[13px] text-ink-muted mt-1 max-w-md mx-auto">
                Nhấn biểu tượng trái tim trên bất kỳ thẻ tour nào để lưu lại và
                so sánh trước khi đặt chuyến đi.
              </p>
              <Link
                href="/tours"
                className="mt-5 inline-flex items-center justify-center px-6 py-2.5 rounded-[8px] bg-client-primary text-white text-[14px] font-semibold hover:bg-client-primary-hover transition-colors"
              >
                Khám Phá Tour Ngay
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {tours.map((tour) => (
                <TourCard key={tour.id} tour={tour} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
