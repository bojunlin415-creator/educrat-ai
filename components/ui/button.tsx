import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-emerald-700/45",
  secondary:
    "border border-emerald-900/15 bg-white text-emerald-950 hover:bg-emerald-50",
  danger: "bg-red-700 text-white hover:bg-red-800",
  ghost: "text-emerald-900 hover:bg-emerald-50",
};

export function Button({
  className,
  children,
  disabled,
  loading = false,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-70",
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
