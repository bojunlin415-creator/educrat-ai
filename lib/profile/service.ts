import "server-only";

import {
  AVATAR_BUCKET,
  AVATAR_SIGNED_URL_TTL_SECONDS,
} from "@/lib/profile/constants";
import { isOwnedAvatarPath } from "@/lib/profile/avatar";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export class ProfileQueryError extends Error {
  constructor() {
    super("目前無法讀取個人資料，請稍後再試。");
    this.name = "ProfileQueryError";
  }
}

export async function getOwnProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new ProfileQueryError();
  return data;
}

export async function getSignedAvatarUrl(
  avatarPath: string | null,
  userId: string,
): Promise<string | null> {
  if (!avatarPath || !isOwnedAvatarPath(avatarPath, userId)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(avatarPath, AVATAR_SIGNED_URL_TTL_SECONDS);

  return error ? null : data.signedUrl;
}
