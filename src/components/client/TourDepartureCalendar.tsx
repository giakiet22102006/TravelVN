"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Plane, Star, Users } from "lucide-react";
import { formatCurrencyVND, formatDateVN } from "@/lib/format";
import type { TourDeparturePublic } from "@/types/ota";

export interface TourDepartureCalendarProps {
  departures: TourDeparturePublic[];
  selectedDepartureId: string | null;
  onSelectDeparture: (dep: TourDeparturePublic) => void;
  selectedLocation: string;
}

const VN_YMD_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toVnYmd(dateInput: string): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  return VN_YMD_FMT.format(d);
}

function formatCompactPrice(amount: number): string {
  if (amount <= 0) return "Liên hệ";
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const rounded = Math.round(millions * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}tr`;
  }
  return `${Math.round(amount / 1_000)}k`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  return `Tháng ${Number(m)}/${y}`;
}

const WEEKDAYS_VN = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function TourDepartureCalendar({
  departures,
  selectedDepartureId,
  onSelectDeparture,
  selectedLocation,
}: TourDepartureCalendarProps) {
  const filteredDepartures = useMemo(() => {
    const byCity = departures.filter(
      (d) => d.departureLocation === selectedLocation
    );
    const list = byCity.length > 0 ? byCity : departures;
    return [...list].sort(
      (a, b) =>
        new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime()
    );
  }, [departures, selectedLocation]);

  const monthKeys = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const dep of filteredDepartures) {
      const ymd = toVnYmd(dep.departureDate);
      if (!ymd) continue;
      const ym = ymd.slice(0, 7);
      if (!seen.has(ym)) {
        seen.add(ym);
        list.push(ym);
      }
    }
    return list;
  }, [filteredDepartures]);

  const selectedDep = useMemo(
    () => filteredDepartures.find((d) => d.id === selectedDepartureId) ?? null,
    [filteredDepartures, selectedDepartureId]
  );

  const [activeMonth, setActiveMonth] = useState<string>(() => {
    if (selectedDep) {
      return toVnYmd(selectedDep.departureDate).slice(0, 7);
    }
    return monthKeys[0] ?? "";
  });

  const selectedDepYm = selectedDep
    ? toVnYmd(selectedDep.departureDate).slice(0, 7)
    : "";

  useEffect(() => {
    if (selectedDepYm && monthKeys.includes(selectedDepYm)) {
      setActiveMonth(selectedDepYm);
    } else if (monthKeys.length > 0) {
      setActiveMonth((prev) =>
        monthKeys.includes(prev) ? prev : monthKeys[0]
      );
    }
  }, [selectedDep?.id, selectedDepYm, monthKeys]);

  const monthDepartures = useMemo(() => {
    if (!activeMonth) return filteredDepartures;
    return filteredDepartures.filter(
      (d) => toVnYmd(d.departureDate).slice(0, 7) === activeMonth
    );
  }, [filteredDepartures, activeMonth]);

  const departuresByDate = useMemo(() => {
    const map = new Map<string, TourDeparturePublic[]>();
    for (const dep of monthDepartures) {
      const ymd = toVnYmd(dep.departureDate);
      if (!ymd) continue;
      const arr = map.get(ymd) ?? [];
      arr.push(dep);
      map.set(ymd, arr);
    }
    return map;
  }, [monthDepartures]);

  const calendarCells = useMemo(() => {
    if (!activeMonth) return [];
    const [yearStr, monthStr] = activeMonth.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) return [];

    const firstDayUtc = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    // Monday-first index: Monday=0 ... Sunday=6
    const jsWeekday = firstDayUtc.getUTCDay();
    const leadingBlanks = (jsWeekday + 6) % 7;

    const cells: Array<{
      key: string;
      dayNumber: number | null;
      ymd: string | null;
    }> = [];

    for (let i = 0; i < leadingBlanks; i++) {
      cells.push({ key: `blank-${i}`, dayNumber: null, ymd: null });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dd = String(day).padStart(2, "0");
      const ymd = `${activeMonth}-${dd}`;
      cells.push({ key: ymd, dayNumber: day, ymd });
    }

    return cells;
  }, [activeMonth]);

  if (filteredDepartures.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Lịch khởi hành và giá vé"
      className="bg-white rounded-[14px] p-5 sm:p-6 border border-border-subtle shadow-sm space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-ink inline-flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-client-primary" />
            <span>Lịch Khởi Hành &amp; Bảng Giá Theo Ngày</span>
          </h2>
          <p className="text-[13px] text-ink-muted mt-0.5">
            Chọn ngày khởi hành từ{" "}
            <strong className="text-ink">{selectedLocation}</strong> để xem giá
            vé và lịch bay chính xác.
          </p>
        </div>

        {/* Month Selector Tabs */}
        {monthKeys.length > 0 && (
          <div
            role="tablist"
            aria-label="Chọn tháng khởi hành"
            className="flex flex-wrap items-center gap-1.5"
          >
            {monthKeys.map((ym) => {
              const isActive = ym === activeMonth;
              return (
                <button
                  key={ym}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveMonth(ym)}
                  className={`px-3 py-1.5 rounded-[8px] text-[12.5px] font-semibold transition-colors tabular-nums ${
                    isActive
                      ? "bg-client-primary text-white shadow-sm"
                      : "bg-surface-muted text-ink hover:bg-client-soft hover:text-client-primary"
                  }`}
                >
                  {formatMonthLabel(ym)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 7-Column Inline Calendar Grid */}
      {calendarCells.length > 0 && (
        <div className="rounded-[12px] border border-border-subtle bg-surface-page/70 p-3 sm:p-4">
          <div className="grid grid-cols-7 gap-1.5 mb-2 text-center">
            {WEEKDAYS_VN.map((w) => (
              <div
                key={w}
                className="text-[11px] font-bold uppercase tracking-wide text-ink-muted py-1"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarCells.map((cell) => {
              if (!cell.dayNumber || !cell.ymd) {
                return <div key={cell.key} className="h-[54px] sm:h-[60px]" />;
              }

              const dayDeps = departuresByDate.get(cell.ymd) ?? [];
              const hasDep = dayDeps.length > 0;

              if (!hasDep) {
                return (
                  <div
                    key={cell.key}
                    className="h-[54px] sm:h-[60px] rounded-[8px] bg-white/60 border border-border-subtle/50 flex flex-col items-center justify-center text-ink-muted/60 text-[12px] tabular-nums"
                  >
                    <span>{cell.dayNumber}</span>
                  </div>
                );
              }

              const activeMatch = dayDeps.find(
                (d) => d.id === selectedDepartureId
              );
              const primaryDep = activeMatch ?? dayDeps[0];
              const isSelected = Boolean(activeMatch);
              const price =
                primaryDep.priceNewAdult > 0
                  ? primaryDep.priceNewAdult
                  : primaryDep.priceAdult;
              const isSoldOut = primaryDep.stockAdult <= 0;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => onSelectDeparture(primaryDep)}
                  aria-label={`Khởi hành ngày ${formatDateVN(primaryDep.departureDate)}, giá ${formatCurrencyVND(price)}`}
                  aria-pressed={isSelected}
                  className={`h-[54px] sm:h-[60px] rounded-[8px] border px-1 flex flex-col items-center justify-center gap-0.5 transition-all tabular-nums ${
                    isSelected
                      ? "bg-client-primary border-client-primary text-white shadow-sm ring-2 ring-client-primary/25"
                      : isSoldOut
                        ? "bg-surface-muted border-border-subtle text-ink-muted hover:border-border-strong"
                        : "bg-white border-client-border text-ink hover:bg-client-soft hover:border-client-primary"
                  }`}
                >
                  <span className="text-[12.5px] font-bold leading-none">
                    {cell.dayNumber}
                  </span>
                  <span
                    className={`text-[10.5px] font-bold leading-none ${
                      isSelected
                        ? "text-client-sun"
                        : isSoldOut
                          ? "text-ink-muted"
                          : "text-client-accent"
                    }`}
                  >
                    {isSoldOut ? "Hết" : formatCompactPrice(price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Clickable Departure Cards */}
      <div className="space-y-2.5">
        <p className="text-[13px] font-semibold text-ink">
          Các đợt khởi hành trong {formatMonthLabel(activeMonth)} (
          {monthDepartures.length} lịch)
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {monthDepartures.map((dep) => {
            const isSelected = dep.id === selectedDepartureId;
            const unitPrice =
              dep.priceNewAdult > 0 ? dep.priceNewAdult : dep.priceAdult;
            const lowStock = dep.stockAdult > 0 && dep.stockAdult <= 4;
            const soldOut = dep.stockAdult <= 0;

            return (
              <button
                key={dep.id}
                type="button"
                onClick={() => onSelectDeparture(dep)}
                aria-pressed={isSelected}
                className={`text-left rounded-[12px] border p-3.5 transition-all space-y-2 ${
                  isSelected
                    ? "border-client-primary bg-client-soft/55 ring-2 ring-client-primary/20 shadow-sm"
                    : "border-border-subtle bg-white hover:border-client-border hover:bg-surface-page/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-client-primary bg-client-soft px-2 py-0.5 rounded tabular-nums">
                        {dep.code}
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-status-success">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Đang chọn
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[13.5px] font-bold text-ink tabular-nums">
                      {formatDateVN(dep.departureDate)}
                      {dep.returnDate
                        ? ` – ${formatDateVN(dep.returnDate)}`
                        : ""}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[15px] font-extrabold text-client-accent tabular-nums">
                      {formatCurrencyVND(unitPrice)}
                    </span>
                    <span className="block text-[11px] text-ink-muted">
                      / người lớn
                    </span>
                  </div>
                </div>

                {(dep.airline || dep.flightOut || dep.flightBack) && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-muted">
                    <Plane className="w-3.5 h-3.5 text-client-primary shrink-0" />
                    <span className="font-medium text-ink">
                      {dep.airline || "Hàng không"}
                    </span>
                    {(dep.flightOut || dep.flightBack) && (
                      <span className="tabular-nums">
                        · {[dep.flightOut, dep.flightBack].filter(Boolean).join(" / ")}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border-subtle/70 text-[11.5px]">
                  <span className="inline-flex items-center gap-1 text-ink-muted font-medium tabular-nums">
                    <Star className="w-3.5 h-3.5 fill-client-star text-client-star" />
                    Khách sạn {dep.hotelStar}★
                  </span>

                  <div className="inline-flex items-center gap-1.5">
                    {lowStock && (
                      <span className="px-2 py-0.5 rounded-full bg-status-warn-bg text-status-warn border border-status-warn-border font-bold text-[10.5px]">
                        Sắp hết chỗ
                      </span>
                    )}
                    {soldOut ? (
                      <span className="px-2 py-0.5 rounded-full bg-status-danger-bg text-status-danger border border-status-danger-border font-bold text-[10.5px]">
                        Hết chỗ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-ink font-semibold tabular-nums">
                        <Users className="w-3.5 h-3.5 text-client-primary" />
                        Còn {dep.stockAdult} chỗ
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
