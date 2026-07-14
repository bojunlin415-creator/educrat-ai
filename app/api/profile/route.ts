import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation/profile";

const MAX_PROFILE_BODY_BYTES = 8 * 1024;

const unauthorizedResponse = () =>
  NextResponse.json(
    { success: false, message: "請先登入後再管理個人資料。" },
    { status: 401 },
  );

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { success: false, message: "目前無法讀取個人資料，請稍後再試。" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: data ? "已取得個人資料。" : "尚未建立個人資料。",
    profile: data,
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    return NextResponse.json(
      { success: false, message: "請使用 JSON 格式送出個人資料。" },
      { status: 415 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_PROFILE_BODY_BYTES
  ) {
    return NextResponse.json(
      { success: false, message: "個人資料內容過大。" },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_PROFILE_BODY_BYTES) {
      return NextResponse.json(
        { success: false, message: "個人資料內容過大。" },
        { status: 413 },
      );
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json(
      { success: false, message: "請提供有效的個人資料。" },
      { status: 400 },
    );
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: "請修正標示的欄位後再送出。",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: existingProfile, error: readError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json(
      { success: false, message: "目前無法儲存個人資料，請稍後再試。" },
      { status: 500 },
    );
  }

  const values = {
    display_name: parsed.data.displayName,
    phone: parsed.data.phone || null,
    locale: parsed.data.locale,
    timezone: parsed.data.timezone,
    onboarding_completed: true,
  };
  const operation = existingProfile
    ? supabase
        .from("profiles")
        .update(values)
        .eq("id", user.id)
        .select("*")
        .single()
    : supabase
        .from("profiles")
        .insert({ id: user.id, ...values })
        .select("*")
        .single();
  const { data, error } = await operation;

  if (error) {
    return NextResponse.json(
      { success: false, message: "目前無法儲存個人資料，請稍後再試。" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "個人資料已儲存。",
    redirectTo: "/dashboard",
    profile: data,
  });
}
