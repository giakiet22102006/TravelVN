import React from "react";

interface AdminAuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AdminAuthCard({
  title,
  subtitle,
  children,
}: AdminAuthCardProps) {
  return (
    <div className="min-h-screen w-full bg-[#4880FF] relative flex items-center justify-center p-4 overflow-hidden">
      {/* Subtle geometric backdrop accents inspired by Figma Project 2 auth template */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 w-[460px] h-[460px] rounded-full bg-white/10" />

      <div className="relative z-10 w-full max-w-[560px] bg-white rounded-[24px] shadow-2xl px-7 py-10 sm:px-12 sm:py-12">
        <div className="text-center mb-8">
          <h1 className="text-[28px] sm:text-[32px] font-bold text-[#202224] tracking-tight">
            {title}
          </h1>
          <p className="text-[15px] text-[#202224]/75 mt-2 font-semibold">
            {subtitle}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
