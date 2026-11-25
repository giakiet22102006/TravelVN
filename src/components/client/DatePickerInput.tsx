"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DatePickerInputProps {
  /** ISO date string YYYY-MM-DD or empty string */
  value: string;
  onChange: (isoDate: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: "hero" | "compact";
  inputId?: string;
}

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function isoToDisplay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function toIsoDate(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Validate dd/mm/yyyy strictly (including leap years) and return YYYY-MM-DD or null */
function parseDisplayToIso(text: string): string | null {
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) {
    return null;
  }
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return toIsoDate(year, month - 1, day);
}

/** Auto-format digits into dd/mm/yyyy while typing */
function formatDateTyping(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function getTodayVN(): {
  year: number;
  month: number;
  day: number;
  iso: string;
} {
  try {
    const iso = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const [y, m, d] = iso.split("-").map(Number);
    if (y && m && d) {
      return { year: y, month: m - 1, day: d, iso };
    }
  } catch {
    // Fallback to local clock if Intl timeZone is unavailable
  }
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
    iso: toIsoDate(now.getFullYear(), now.getMonth(), now.getDate()),
  };
}

export function DatePickerInput({
  value,
  onChange,
  open: controlledOpen,
  onOpenChange,
  variant = "hero",
  inputId,
}: DatePickerInputProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const setOpen = (next: boolean) => {
    if (onOpenChangeRef.current) onOpenChangeRef.current(next);
    if (controlledOpen === undefined) setInternalOpen(next);
  };

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (onOpenChangeRef.current) onOpenChangeRef.current(false);
        if (controlledOpen === undefined) setInternalOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (onOpenChangeRef.current) onOpenChangeRef.current(false);
        if (controlledOpen === undefined) setInternalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const initialVnDate = useMemo(() => getTodayVN(), []);
  const [today, setToday] = useState<{
    year: number;
    month: number;
    day: number;
    iso: string;
  } | null>(null);

  useEffect(() => {
    setToday(getTodayVN());
  }, []);

  const [textValue, setTextValue] = useState<string>(() => isoToDisplay(value));
  const [prevValue, setPrevValue] = useState<string>(value);
  const [viewYear, setViewYear] = useState<number>(() =>
    value ? Number(value.slice(0, 4)) : initialVnDate.year
  );
  const [viewMonth, setViewMonth] = useState<number>(() =>
    value ? Number(value.slice(5, 7)) - 1 : initialVnDate.month
  );

  // Sync external value changes into display text & calendar month
  if (value !== prevValue) {
    setPrevValue(value);
    setTextValue(isoToDisplay(value));
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setViewYear(Number(value.slice(0, 4)));
      setViewMonth(Number(value.slice(5, 7)) - 1);
    }
  }

  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    // Monday = 0 ... Sunday = 6
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{
      day: number;
      inCurrentMonth: boolean;
      iso: string;
    }> = [];

    for (let i = startOffset - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({
        day: d,
        inCurrentMonth: false,
        iso: toIsoDate(prevY, prevM, d),
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        inCurrentMonth: true,
        iso: toIsoDate(viewYear, viewMonth, d),
      });
    }

    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({
        day: d,
        inCurrentMonth: false,
        iso: toIsoDate(nextY, nextM, d),
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  function handlePrevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatDateTyping(e.target.value);
    setTextValue(formatted);

    if (!formatted) {
      onChange("");
      return;
    }

    const parsedIso = parseDisplayToIso(formatted);
    if (parsedIso) {
      onChange(parsedIso);
      setViewYear(Number(parsedIso.slice(0, 4)));
      setViewMonth(Number(parsedIso.slice(5, 7)) - 1);
    }
  }

  function handleInputBlur() {
    if (!textValue.trim()) {
      onChange("");
      return;
    }
    const parsedIso = parseDisplayToIso(textValue);
    if (!parsedIso) {
      setTextValue(isoToDisplay(value));
    }
  }

  function handleSelectIso(iso: string) {
    onChange(iso);
    setTextValue(isoToDisplay(iso));
    setViewYear(Number(iso.slice(0, 4)));
    setViewMonth(Number(iso.slice(5, 7)) - 1);
    setOpen(false);
  }

  const isCompact = variant === "compact";

  return (
    <div
      ref={containerRef}
      onBlur={(e) => {
        const nextFocused = e.relatedTarget as Node | null;
        if (nextFocused && !containerRef.current?.contains(nextFocused)) {
          setOpen(false);
        }
      }}
      className={isCompact ? "relative" : "md:col-span-3 relative"}
    >
      <div
        onClick={() => setOpen(true)}
        className={
          isCompact
            ? "w-full h-[40px] px-3 rounded-[8px] border border-[#CCD1D2] bg-white flex items-center gap-2 text-[#25282B] cursor-pointer focus-within:border-[#4502C7] focus-within:ring-2 focus-within:ring-[#4502C7]/20 transition-shadow"
            : "bg-white rounded-[10px] h-[54px] px-3.5 flex items-center gap-2.5 text-[#25282B] cursor-pointer focus-within:ring-2 focus-within:ring-[#FFD600] transition-shadow"
        }
      >
        <Calendar
          className={`${
            isCompact ? "w-4 h-4" : "w-5 h-5"
          } text-[#4502C7] shrink-0`}
        />
        <div className="flex-1 min-w-0">
          {!isCompact && (
            <span className="block text-[10px] text-[#667479] leading-none mb-0.5">
              Lịch khởi hành
            </span>
          )}
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            value={textValue}
            onFocus={() => setOpen(true)}
            onChange={handleTextChange}
            onBlur={handleInputBlur}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="dd/mm/yyyy"
            maxLength={10}
            aria-label="Ngày khởi hành"
            className="w-full bg-transparent text-[13px] font-medium placeholder:text-[#667085] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4502C7]/40 rounded"
          />
        </div>
        {(textValue || value) && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Xóa ngày khởi hành"
            onClick={(e) => {
              e.stopPropagation();
              setTextValue("");
              onChange("");
            }}
            className="w-6 h-6 rounded-full text-[#667479] hover:bg-[#F3EEFF] hover:text-[#4502C7] flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          className={`absolute top-[calc(100%+8px)] w-[min(290px,calc(100vw-2rem))] max-w-full sm:w-[300px] bg-white rounded-[12px] shadow-2xl border border-[#ECECEC] p-3 sm:p-4 z-50 text-[#25282B] ${
            isCompact ? "left-0 lg:max-w-none" : "left-0 sm:max-w-none"
          }`}
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Tháng trước"
              className="w-8 h-8 rounded-[8px] border border-[#ECECEC] hover:border-[#4502C7] hover:bg-[#F3EEFF] text-[#4502C7] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4502C7]/40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-[14px] font-bold text-[#25282B]">
              Tháng {viewMonth + 1}, {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Tháng sau"
              className="w-8 h-8 rounded-[8px] border border-[#ECECEC] hover:border-[#4502C7] hover:bg-[#F3EEFF] text-[#4502C7] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4502C7]/40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 mb-1.5 text-center">
            {WEEKDAYS.map((wd) => (
              <span
                key={wd}
                className="text-[11px] font-semibold text-[#667479] py-1"
              >
                {wd}
              </span>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarCells.map((cell) => {
              const isSelected = value === cell.iso;
              const isToday = today?.iso === cell.iso;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => handleSelectIso(cell.iso)}
                  aria-label={`Chọn ngày ${isoToDisplay(cell.iso)}`}
                  aria-pressed={isSelected}
                  className={`h-8 rounded-[8px] text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4502C7]/40 ${
                    isSelected
                      ? "bg-[#4502C7] text-white font-bold shadow-sm"
                      : isToday
                        ? "bg-[#F3EEFF] text-[#4502C7] font-bold ring-1 ring-[#4502C7]/40"
                        : cell.inCurrentMonth
                          ? "text-[#25282B] hover:bg-[#F3EEFF] hover:text-[#4502C7]"
                          : "text-[#667085] hover:bg-[#F6F6F6]"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="mt-3 pt-2.5 border-t border-[#ECECEC] flex items-center justify-between text-[12px]">
            <button
              type="button"
              onClick={() => {
                setTextValue("");
                onChange("");
                setOpen(false);
              }}
              className="font-medium text-[#667479] hover:text-[#DA0808] transition-colors"
            >
              Xóa ngày
            </button>
            <button
              type="button"
              onClick={() => handleSelectIso((today ?? getTodayVN()).iso)}
              className="font-semibold text-[#4502C7] hover:underline"
            >
              Hôm nay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
