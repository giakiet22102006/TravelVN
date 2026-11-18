import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export interface UploadResult {
  url: string;
  provider: "cloudinary" | "local" | "inline";
}

interface StorageAdapter {
  upload(file: File): Promise<UploadResult>;
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

  async upload(file: File): Promise<UploadResult> {
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

    const formData = new FormData();
    formData.append("file", file);
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
  async upload(file: File): Promise<UploadResult> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    const ext = path.extname(file.name) || ".webp";
    const baseName = path
      .basename(file.name, ext)
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48);

    const fileName = `${Date.now()}-${baseName || "image"}${ext}`;
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
      const mimeType = file.type || "image/webp";
      return {
        url: `data:${mimeType};base64,${buffer.toString("base64")}`,
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

  async uploadImage(file: File): Promise<UploadResult> {
    return this.getAdapter().upload(file);
  },
};
