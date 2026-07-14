"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  AVATAR_ACCEPT,
  AVATAR_MAX_BYTES,
  PROFILE_LOCALE_OPTIONS,
  PROFILE_TIMEZONE_OPTIONS,
} from "@/lib/profile/constants";
import {
  avatarApiResponseSchema,
  profileApiResponseSchema,
  profileSchema,
  type ProfileInput,
} from "@/lib/validation/profile";

type FormStatus =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

const profileFieldNames = [
  "displayName",
  "phone",
  "locale",
  "timezone",
] as const;

function isProfileFieldName(value: string): value is keyof ProfileInput {
  return profileFieldNames.some((fieldName) => fieldName === value);
}

export function ProfileForm({
  allowAvatar,
  defaultValues,
  initialAvatarUrl,
  mode,
}: {
  allowAvatar: boolean;
  defaultValues: ProfileInput;
  initialAvatarUrl: string | null;
  mode: "onboarding" | "settings";
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<FormStatus>({ type: "idle" });
  const [avatarStatus, setAvatarStatus] = useState<FormStatus>({
    type: "idle",
  });
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    defaultValues,
    resolver: zodResolver(profileSchema),
  });

  async function onSubmit(values: ProfileInput) {
    setStatus({ type: "idle" });
    try {
      const response = await fetch("/api/profile", {
        body: JSON.stringify(values),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      const payload: unknown = await response.json();
      const parsed = profileApiResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("伺服器回應格式不正確。");

      if (!response.ok || !parsed.data.success) {
        Object.entries(parsed.data.fieldErrors ?? {}).forEach(
          ([fieldName, messages]) => {
            if (isProfileFieldName(fieldName) && messages[0]) {
              setError(fieldName, { message: messages[0], type: "server" });
            }
          },
        );
        setStatus({ type: "error", message: parsed.data.message });
        return;
      }

      setStatus({ type: "success", message: parsed.data.message });
      if (mode === "onboarding") {
        router.replace(parsed.data.redirectTo ?? "/dashboard");
        router.refresh();
      }
    } catch (error: unknown) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "目前無法儲存個人資料，請稍後再試。",
      });
    }
  }

  async function uploadAvatar(file: File) {
    setAvatarStatus({ type: "idle" });
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarStatus({ type: "error", message: "圖片大小不得超過 2 MB。" });
      return;
    }
    if (!AVATAR_ACCEPT.split(",").includes(file.type)) {
      setAvatarStatus({
        type: "error",
        message: "只支援 JPEG、PNG 或 WebP 圖片。",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("avatar", file);
      const response = await fetch("/api/profile/avatar", {
        body: formData,
        method: "POST",
      });
      const payload: unknown = await response.json();
      const parsed = avatarApiResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("伺服器回應格式不正確。");
      if (!response.ok || !parsed.data.success) {
        setAvatarStatus({ type: "error", message: parsed.data.message });
        return;
      }

      setAvatarUrl(parsed.data.avatarUrl ?? null);
      setAvatarStatus({ type: "success", message: parsed.data.message });
    } catch (error: unknown) {
      setAvatarStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "目前無法上傳圖片，請稍後再試。",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setAvatarStatus({ type: "idle" });
    setIsRemoving(true);
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      const payload: unknown = await response.json();
      const parsed = avatarApiResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("伺服器回應格式不正確。");
      if (!response.ok || !parsed.data.success) {
        setAvatarStatus({ type: "error", message: parsed.data.message });
        return;
      }

      setAvatarUrl(null);
      setAvatarStatus({ type: "success", message: parsed.data.message });
    } catch (error: unknown) {
      setAvatarStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "目前無法移除圖片，請稍後再試。",
      });
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="space-y-8">
      {allowAvatar ? (
        <section aria-labelledby="avatar-title">
          <h2 className="text-lg font-black text-emerald-950" id="avatar-title">
            個人圖片
          </h2>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              aria-label={avatarUrl ? "目前的個人圖片" : "尚未設定個人圖片"}
              className="grid size-24 shrink-0 place-items-center rounded-3xl border border-emerald-950/10 bg-emerald-50 bg-cover bg-center text-3xl font-black text-emerald-800"
              role="img"
              style={
                avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined
              }
            >
              {avatarUrl ? null : "師"}
            </div>
            <div className="flex-1">
              <p className="text-sm leading-6 text-slate-600">
                支援 JPEG、PNG、WebP，檔案上限 2
                MB。系統會在伺服器再次驗證圖片內容。
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <input
                  accept={AVATAR_ACCEPT}
                  aria-label="選擇個人圖片"
                  className="block max-w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:font-bold file:text-white"
                  disabled={isUploading || isRemoving}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void uploadAvatar(file);
                  }}
                  ref={fileInputRef}
                  type="file"
                />
                {avatarUrl ? (
                  <Button
                    loading={isRemoving}
                    onClick={() => void removeAvatar()}
                    variant="secondary"
                  >
                    移除圖片
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          {isUploading ? (
            <p
              className="mt-3 text-sm font-bold text-emerald-800"
              role="status"
            >
              圖片上傳中…
            </p>
          ) : null}
          {avatarStatus.type !== "idle" ? (
            <Alert
              className="mt-4"
              title={
                avatarStatus.type === "success" ? "上傳完成" : "圖片未更新"
              }
              variant={avatarStatus.type}
            >
              {avatarStatus.message}
            </Alert>
          ) : null}
        </section>
      ) : null}

      <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            autoComplete="name"
            error={errors.displayName?.message}
            label="顯示名稱"
            placeholder="例如：林老師"
            {...register("displayName")}
          />
          <Input
            autoComplete="tel"
            error={errors.phone?.message}
            hint="選填，只會用於帳號與機構聯絡。"
            inputMode="tel"
            label="電話"
            {...register("phone")}
          />
          <Select
            error={errors.locale?.message}
            label="介面語言"
            options={[...PROFILE_LOCALE_OPTIONS]}
            {...register("locale")}
          />
          <Select
            error={errors.timezone?.message}
            label="時區"
            options={[...PROFILE_TIMEZONE_OPTIONS]}
            {...register("timezone")}
          />
        </div>

        {status.type !== "idle" ? (
          <Alert
            title={status.type === "success" ? "儲存完成" : "無法儲存"}
            variant={status.type}
          >
            {status.message}
          </Alert>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {mode === "settings" ? (
            <Button
              onClick={() => router.push("/dashboard")}
              variant="secondary"
            >
              返回工作台
            </Button>
          ) : null}
          <Button loading={isSubmitting} type="submit">
            {mode === "onboarding" ? "完成基本資料" : "儲存變更"}
          </Button>
        </div>
      </form>
    </div>
  );
}
