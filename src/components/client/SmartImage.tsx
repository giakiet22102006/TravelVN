"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Compass } from "lucide-react";
import {
  enhanceImageUrl,
  isNextImageOptimizable,
} from "@/lib/image-quality";

interface SmartImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  targetWidth?: number;
  quality?: number;
  priority?: boolean;
  sizes?: string;
  fill?: boolean;
  width?: number;
  height?: number;
}

/**
 * Wrapper around `next/image` that automatically upgrades Unsplash/Cloudinary URLs for HiDPI
 * clarity while safely handling arbitrary external URLs (`unoptimized` fallback) so Admin-uploaded
 * images from third-party hosts never crash runtime domain allowlists.
 */
export function SmartImage({
  src,
  alt,
  className = "",
  targetWidth = 1000,
  quality = 82,
  priority = false,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  fill = true,
  width,
  height,
}: SmartImageProps) {
  const finalSrc = enhanceImageUrl(src, targetWidth, quality);
  const canOptimize = isNextImageOptimizable(finalSrc);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [finalSrc]);

  if (hasError || !finalSrc) {
    return (
      <div
        role="img"
        aria-label={alt}
        style={!fill && width && height ? { width, height } : undefined}
        className={`${
          fill ? "absolute inset-0" : ""
        } flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-client-soft via-surface-muted to-client-border/60 text-client-primary select-none ${className}`}
      >
        <Compass className="w-6 h-6 opacity-75" />
        <span className="text-[10px] font-bold tracking-wider uppercase opacity-80">
          VN.TRAVEL
        </span>
      </div>
    );
  }

  if (!fill && width && height) {
    return (
      <Image
        src={finalSrc}
        alt={alt}
        width={width}
        height={height}
        quality={quality}
        priority={priority}
        sizes={sizes}
        unoptimized={!canOptimize}
        onError={() => setHasError(true)}
        className={className}
      />
    );
  }

  return (
    <Image
      src={finalSrc}
      alt={alt}
      fill
      quality={quality}
      priority={priority}
      sizes={sizes}
      unoptimized={!canOptimize}
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
