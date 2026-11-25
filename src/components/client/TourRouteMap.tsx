"use client";

import React, { useMemo } from "react";
import { Compass, MapPin, Navigation } from "lucide-react";
import type { TourWaypoint } from "@/types/ota";

interface ScheduleItem {
  title: string;
  description: string;
}

export interface TourRouteMapProps {
  waypoints?: unknown;
  schedules?: ScheduleItem[];
  activeDay: number;
  onSelectDay: (day: number) => void;
  tourName?: string;
}

interface NormalizedPin extends TourWaypoint {
  x: number;
  y: number;
}

function parseWaypoints(
  raw: unknown,
  schedules: ScheduleItem[]
): TourWaypoint[] {
  if (Array.isArray(raw)) {
    const valid = raw
      .filter(
        (item): item is TourWaypoint =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as TourWaypoint).day === "number" &&
          typeof (item as TourWaypoint).label === "string" &&
          Number.isFinite((item as TourWaypoint).lat) &&
          Number.isFinite((item as TourWaypoint).lng)
      )
      .sort((a, b) => a.day - b.day);
    if (valid.length > 0) return valid;
  }

  // Schematic fallback from schedules titles when routeWaypoints is empty
  return schedules.map((sch, idx) => {
    const cleanedLabel = sch.title
      .replace(/^ngày\s*\d+\s*[:\-–.]?\s*/i, "")
      .trim();
    const angle = idx * 0.85;
    return {
      day: idx + 1,
      label: cleanedLabel || sch.title || `Điểm dừng ngày ${idx + 1}`,
      lat: 16 + Math.sin(angle) * 2.2 + idx * 0.45,
      lng: 105 + idx * 1.35 + Math.cos(angle) * 0.4,
      note: sch.description ? sch.description.slice(0, 72) : undefined,
    };
  });
}

function projectWaypoints(waypoints: TourWaypoint[]): NormalizedPin[] {
  const WIDTH = 640;
  const HEIGHT = 300;
  const PAD_X = 76;
  const PAD_Y = 56;

  if (waypoints.length === 0) return [];
  if (waypoints.length === 1) {
    return [{ ...waypoints[0], x: WIDTH / 2, y: HEIGHT / 2 }];
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const w of waypoints) {
    if (w.lat < minLat) minLat = w.lat;
    if (w.lat > maxLat) maxLat = w.lat;
    if (w.lng < minLng) minLng = w.lng;
    if (w.lng > maxLng) maxLng = w.lng;
  }

  const spanLng = maxLng - minLng;
  const spanLat = maxLat - minLat;

  return waypoints.map((w, idx) => {
    const normX =
      spanLng > 0.0001
        ? (w.lng - minLng) / spanLng
        : waypoints.length > 1
          ? idx / (waypoints.length - 1)
          : 0.5;
    const normY =
      spanLat > 0.0001
        ? 1 - (w.lat - minLat) / spanLat
        : 0.5 + Math.sin(idx * 1.1) * 0.25;

    return {
      ...w,
      x: Math.round((PAD_X + normX * (WIDTH - PAD_X * 2)) * 10) / 10,
      y: Math.round((PAD_Y + normY * (HEIGHT - PAD_Y * 2)) * 10) / 10,
    };
  });
}

function buildSmoothPath(pins: NormalizedPin[]): string {
  if (pins.length === 0) return "";
  if (pins.length === 1) return `M ${pins[0].x} ${pins[0].y}`;

  let d = `M ${pins[0].x} ${pins[0].y}`;
  for (let i = 0; i < pins.length - 1; i++) {
    const p0 = pins[i];
    const p1 = pins[i + 1];
    const midX = (p0.x + p1.x) / 2;
    const ctrlYOffset = i % 2 === 0 ? -14 : 14;
    const midY = (p0.y + p1.y) / 2 + ctrlYOffset;
    d += ` Q ${midX.toFixed(1)} ${midY.toFixed(1)}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export function TourRouteMap({
  waypoints,
  schedules = [],
  activeDay,
  onSelectDay,
  tourName,
}: TourRouteMapProps) {
  const parsedWaypoints = useMemo(
    () => parseWaypoints(waypoints, schedules),
    [waypoints, schedules]
  );

  const pins = useMemo(
    () => projectWaypoints(parsedWaypoints),
    [parsedWaypoints]
  );

  if (pins.length === 0) return null;

  const activePin =
    pins.find((p) => p.day === activeDay) ?? pins[0];
  const pathData = buildSmoothPath(pins);

  return (
    <div className="bg-white rounded-[14px] p-5 sm:p-6 border border-border-subtle shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-client-primary" />
          <h2 className="text-[20px] font-bold text-ink">
            Bản Đồ Tuyến Điểm Hành Trình
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-client-primary bg-client-soft px-3 py-1 rounded-full border border-client-border tabular-nums">
          <Compass className="w-3.5 h-3.5" />
          {pins.length} chặng tham quan
        </span>
      </div>

      {/* Interactive SVG Route Canvas */}
      <div className="relative rounded-[12px] border border-client-border overflow-hidden bg-surface-page">
        <svg
          viewBox="0 0 640 300"
          role="img"
          aria-label={`Bản đồ lộ trình ${tourName || "tour du lịch"}`}
          className="w-full h-auto block select-none"
        >
          {/* Stylized Grid & Coastline Backdrop */}
          <rect
            x="0"
            y="0"
            width="640"
            height="300"
            className="fill-surface-page"
          />
          <path
            d="M 0 235 Q 160 195, 320 225 T 640 190 L 640 300 L 0 300 Z"
            className="fill-client-soft/80"
          />
          <path
            d="M 0 70 Q 190 45, 390 78 T 640 52 L 640 0 L 0 0 Z"
            className="fill-client-soft/45"
          />

          {/* Latitude / Longitude reference grid lines */}
          {[75, 150, 225].map((y) => (
            <line
              key={`h-${y}`}
              x1="0"
              y1={y}
              x2="640"
              y2={y}
              className="stroke-border-subtle"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          ))}
          {[128, 256, 384, 512].map((x) => (
            <line
              key={`v-${x}`}
              x1={x}
              y1="0"
              x2={x}
              y2="300"
              className="stroke-border-subtle"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          ))}

          {/* Curved Dashed Route Connector */}
          {pins.length > 1 && (
            <>
              <path
                d={pathData}
                fill="none"
                className="stroke-client-border"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d={pathData}
                fill="none"
                className="stroke-client-primary"
                strokeWidth="2.5"
                strokeDasharray="7 6"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Clickable Day Pins */}
          {pins.map((pin) => {
            const isActive = pin.day === activePin.day;
            const labelY = pin.y < 70 ? pin.y + 30 : pin.y - 24;
            const shortLabel =
              pin.label.length > 22 ? `${pin.label.slice(0, 20)}…` : pin.label;

            return (
              <g
                key={`${pin.day}-${pin.label}`}
                role="button"
                tabIndex={0}
                aria-label={`Ngày ${pin.day}: ${pin.label}`}
                aria-pressed={isActive}
                onClick={() => onSelectDay(pin.day)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectDay(pin.day);
                  }
                }}
                className="cursor-pointer focus:outline-none"
              >
                {isActive && (
                  <circle
                    cx={pin.x}
                    cy={pin.y}
                    r="21"
                    className="fill-client-accent/20"
                  />
                )}
                <circle
                  cx={pin.x}
                  cy={pin.y}
                  r={isActive ? 15 : 12.5}
                  className={
                    isActive
                      ? "fill-client-accent stroke-white"
                      : "fill-client-primary stroke-white hover:fill-client-primary-hover"
                  }
                  strokeWidth="2.5"
                />
                <text
                  x={pin.x}
                  y={pin.y + 4}
                  textAnchor="middle"
                  className="fill-white text-[11px] font-bold pointer-events-none"
                >
                  {pin.day}
                </text>

                {/* Pin short label */}
                <g transform={`translate(${pin.x}, ${labelY})`}>
                  <rect
                    x="-66"
                    y="-11"
                    width="132"
                    height="20"
                    rx="10"
                    className={
                      isActive
                        ? "fill-client-deep stroke-client-deep"
                        : "fill-white/95 stroke-border-subtle"
                    }
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    className={`text-[10.5px] font-semibold pointer-events-none ${
                      isActive ? "fill-white" : "fill-ink"
                    }`}
                  >
                    {shortLabel}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Day Pills & Active Destination Info */}
      <div className="flex flex-wrap items-center gap-2">
        {pins.map((pin) => {
          const isActive = pin.day === activePin.day;
          return (
            <button
              key={pin.day}
              type="button"
              onClick={() => onSelectDay(pin.day)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors tabular-nums ${
                isActive
                  ? "bg-client-accent text-white shadow-sm"
                  : "bg-surface-muted text-ink hover:bg-client-soft hover:text-client-primary"
              }`}
            >
              Ngày {pin.day}
            </button>
          );
        })}
      </div>

      <div className="rounded-[10px] bg-client-soft/65 border border-client-border px-4 py-3 flex items-start gap-3">
        <MapPin className="w-4 h-4 text-client-accent shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-ink">
            Ngày {activePin.day}: {activePin.label}
          </p>
          {activePin.note && (
            <p className="text-[12.5px] text-ink-muted mt-0.5 leading-relaxed">
              {activePin.note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
