import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export interface SafeImageType {
  mime: string;
  ext: string;
}

/**
 * Inspects file magic bytes to allow only genuine raster images (JPEG, PNG, GIF, WebP)
 * and block polyglots, SVG/HTML/XML XSS payloads, or spoofed Content-Type headers.
 */
export function detectSafeImageType(buffer: Buffer): SafeImageType | null {
  if (buffer.length < 3) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", ext: ".png" };
  }

  // GIF: GIF87a or GIF89a
  if (buffer.length >= 6) {
    const header6 = buffer.subarray(0, 6).toString("ascii");
    if (header6 === "GIF87a" || header6 === "GIF89a") {
      return { mime: "image/gif", ext: ".gif" };
    }
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", ext: ".webp" };
  }

  return null;
}

export interface UploadResult {
  url: string;
  provider: "cloudinary" | "local" | "inline";
}

interface StorageAdapter {
  upload(file: File, buffer: Buffer, detected: SafeImageType): Promise<UploadResult>;
}

function parseCloudinaryUrl(rawUrl: string) {
  // Format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
  const parsed = new URL(rawUrl);
  return {
    apiKey: decodeURIComponent(parsed.username),
    apiSecret: decodeURIComponent(parsed.password),
    cloudName: parsed.hostname,
  };
}

class CloudinaryStorageAdapter implements StorageAdapter {
  private cloudinaryUrl: string;

  constructor(cloudinaryUrl: string) {
    this.cloudinaryUrl = cloudinaryUrl;
  }

  async upload(
    file: File,
    _buffer: Buffer,
    detected: SafeImageType
  ): Promise<UploadResult> {
    const { apiKey, apiSecret, cloudName } = parseCloudinaryUrl(
      this.cloudinaryUrl
    );
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = "travelvn";
    const signaturePayload = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto
      .createHash("sha1")
      .update(signaturePayload)
      .digest("hex");

    const safeFile = new File([file], `${crypto.randomUUID()}${detected.ext}`, {
      type: detected.mime,
    });
    const formData = new FormData();
    formData.append("file", safeFile);
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp);
    formData.append("folder", folder);
    formData.append("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudinary upload failed: ${errorText}`);
    }

    const data = (await response.json()) as { secure_url: string };
    return {
      url: data.secure_url,
      provider: "cloudinary",
    };
  }
}

class LocalStorageAdapter implements StorageAdapter {
  async upload(
    _file: File,
    buffer: Buffer,
    detected: SafeImageType
  ): Promise<UploadResult> {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const fileName = `${crypto.randomUUID()}${detected.ext}`;
    const targetPath = path.join(uploadDir, fileName);

    try {
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(targetPath, buffer);
      return {
        url: `/uploads/${fileName}`,
        provider: "local",
      };
    } catch {
      // Read-only serverless filesystem fallback (e.g., Vercel without CLOUDINARY_URL):
      // client-side canvas pre-optimization keeps payloads compact enough for DB persistence.
      return {
        url: `data:${detected.mime};base64,${buffer.toString("base64")}`,
        provider: "inline",
      };
    }
  }
}

/**
 * StorageService uses the Adapter Pattern: automatically streams images to
 * Cloudinary CDN when CLOUDINARY_URL is configured, and falls back to
 * public/uploads/ (or inline data URI on read-only serverless hosts).
 */
export const StorageService = {
  getAdapter(): StorageAdapter {
    const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();
    if (cloudinaryUrl && cloudinaryUrl.startsWith("cloudinary://")) {
      return new CloudinaryStorageAdapter(cloudinaryUrl);
    }
    return new LocalStorageAdapter();
  },

  async uploadImage(file: File, precomputedBuffer?: Buffer): Promise<UploadResult> {
    const buffer = precomputedBuffer ?? Buffer.from(await file.arrayBuffer());
    const detected = detectSafeImageType(buffer);
    if (!detected) {
      throw new Error("UNSUPPORTED_IMAGE_TYPE");
    }
    return this.getAdapter().upload(file, buffer, detected);
  },
};
