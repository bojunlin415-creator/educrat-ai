import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isOwnedAvatarPath, validateAvatarFile } from "@/lib/profile/avatar";
import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  AVATAR_SIGNED_URL_TTL_SECONDS,
} from "@/lib/profile/constants";
import { createClient } from "@/lib/supabase/server";

const MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024;

const unauthorizedResponse = () =>
  NextResponse.json(
    { success: false, message: "請先登入後再上傳圖片。" },
    { status: 401 },
  );

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(contentLength) &&
    contentLength > AVATAR_MAX_BYTES + MAX_MULTIPART_OVERHEAD_BYTES
  ) {
    return NextResponse.json(
      { success: false, message: "圖片大小不得超過 2 MB。" },
      { status: 413 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, message: "無法讀取上傳內容，請重新選擇圖片。" },
      { status: 400 },
    );
  }

  const file = formData.get("avatar");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, message: "請選擇要上傳的圖片。" },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateAvatarFile({
    bytes: bytes.slice(0, 16),
    declaredMime: file.type,
    size: file.size,
  });
  if (!validation.success) {
    return NextResponse.json(
      { success: false, message: validation.message },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { success: false, message: "目前無法讀取個人資料，請稍後再試。" },
      { status: 500 },
    );
  }
  if (!profile) {
    return NextResponse.json(
      { success: false, message: "請先完成基本資料，再上傳個人圖片。" },
      { status: 409 },
    );
  }

  const avatarPath = `${user.id}/avatar-${crypto.randomUUID()}.${validation.extension}`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(avatarPath, bytes, {
      cacheControl: "3600",
      contentType: validation.mime,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { success: false, message: "圖片上傳失敗，請稍後再試。" },
      { status: 500 },
    );
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarPath })
    .eq("id", user.id);

  if (updateError) {
    await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]);
    return NextResponse.json(
      { success: false, message: "無法更新個人圖片，請稍後再試。" },
      { status: 500 },
    );
  }

  if (
    profile.avatar_url &&
    profile.avatar_url !== avatarPath &&
    isOwnedAvatarPath(profile.avatar_url, user.id)
  ) {
    await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_url]);
  }

  const { data: signedData } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(avatarPath, AVATAR_SIGNED_URL_TTL_SECONDS);

  return NextResponse.json({
    success: true,
    message: "個人圖片已更新。",
    avatarUrl: signedData?.signedUrl ?? null,
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { success: false, message: "目前無法讀取個人資料，請稍後再試。" },
      { status: 500 },
    );
  }
  if (!profile) {
    return NextResponse.json(
      { success: false, message: "尚未建立個人資料。" },
      { status: 404 },
    );
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json(
      { success: false, message: "目前無法移除個人圖片，請稍後再試。" },
      { status: 500 },
    );
  }

  if (profile.avatar_url && isOwnedAvatarPath(profile.avatar_url, user.id)) {
    await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_url]);
  }

  return NextResponse.json({ success: true, message: "個人圖片已移除。" });
}
