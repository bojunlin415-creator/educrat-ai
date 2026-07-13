import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({
  className,
  error,
  hint,
  id,
  label,
  ...props
}: InputProps) {
  const fallbackId = props.name ? `input-${props.name}` : undefined;
  const inputId = id ?? fallbackId;
  const descriptionId = inputId ? `${inputId}-description` : undefined;

  return (
    <label className="block font-bold text-emerald-950" htmlFor={inputId}>
      {label}
      <input
        aria-describedby={error || hint ? descriptionId : undefined}
        aria-invalid={Boolean(error)}
        className={cn(
          "mt-2 block min-h-11 w-full rounded-xl border bg-white px-4 py-2.5 font-normal text-slate-900 placeholder:text-slate-400",
          error
            ? "border-red-500"
            : "border-slate-300 hover:border-emerald-600",
          className,
        )}
        id={inputId}
        {...props}
      />
      {error ? (
        <span
          className="mt-1.5 block text-sm font-medium text-red-700"
          id={descriptionId}
        >
          {error}
        </span>
      ) : hint ? (
        <span
          className="mt-1.5 block text-sm font-normal text-slate-500"
          id={descriptionId}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}
