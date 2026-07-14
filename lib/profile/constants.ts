export const PROFILE_LOCALE_OPTIONS = [
  { label: "繁體中文（台灣）", value: "zh-TW" },
  { label: "English (United States)", value: "en-US" },
] as const;

export const PROFILE_TIMEZONE_OPTIONS = [
  { label: "台北（UTC+8）", value: "Asia/Taipei" },
  { label: "東京（UTC+9）", value: "Asia/Tokyo" },
  { label: "首爾（UTC+9）", value: "Asia/Seoul" },
  { label: "新加坡（UTC+8）", value: "Asia/Singapore" },
  { label: "世界協調時間（UTC）", value: "UTC" },
] as const;

export const PROFILE_LOCALES = PROFILE_LOCALE_OPTIONS.map(
  (option) => option.value,
);

export const PROFILE_TIMEZONES = PROFILE_TIMEZONE_OPTIONS.map(
  (option) => option.value,
);

export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
export const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60;
