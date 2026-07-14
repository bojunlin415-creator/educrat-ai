import { AVATAR_ACCEPT, AVATAR_MAX_BYTES } from "@/lib/profile/constants";

export type SupportedAvatarMime = "image/jpeg" | "image/png" | "image/webp";

export interface AvatarFileMetadata {
  bytes: Uint8Array;
  declaredMime: string;
  size: number;
}

export type AvatarValidationResult =
  | {
      success: true;
      extension: "jpg" | "png" | "webp";
      mime: SupportedAvatarMime;
    }
  | { success: false; message: string };

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function detectMime(bytes: Uint8Array): SupportedAvatarMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function validateAvatarFile({
  bytes,
  declaredMime,
  size,
}: AvatarFileMetadata): AvatarValidationResult {
  if (size <= 0) {
    return { success: false, message: "請選擇要上傳的圖片。" };
  }
  if (size > AVATAR_MAX_BYTES) {
    return { success: false, message: "圖片大小不得超過 2 MB。" };
  }

  const detectedMime = detectMime(bytes);
  if (!detectedMime || !AVATAR_ACCEPT.split(",").includes(detectedMime)) {
    return {
      success: false,
      message: "只支援 JPEG、PNG 或 WebP 圖片。",
    };
  }
  if (declaredMime !== detectedMime) {
    return {
      success: false,
      message: "圖片格式與檔案內容不一致，請重新選擇。",
    };
  }

  const extensions: Record<SupportedAvatarMime, "jpg" | "png" | "webp"> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return {
    success: true,
    extension: extensions[detectedMime],
    mime: detectedMime,
  };
}

export function isOwnedAvatarPath(path: string, userId: string) {
  const segments = path.split("/");
  return (
    segments.length === 2 &&
    segments[0] === userId &&
    Boolean(segments[1]) &&
    !path.includes("..")
  );
}
