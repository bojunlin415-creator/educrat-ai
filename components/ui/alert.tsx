import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  children: ReactNode;
  variant?: AlertVariant;
}

const variants: Record<AlertVariant, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  error: "border-red-200 bg-red-50 text-red-950",
};

export function Alert({
  className,
  children,
  title,
  variant = "info",
  ...props
}: AlertProps) {
  return (
    <div
      className={cn("rounded-xl border p-4", variants[variant], className)}
      role={variant === "error" ? "alert" : "status"}
      {...props}
    >
      <p className="font-black">{title}</p>
      <div className="mt-1 text-sm leading-6 opacity-85">{children}</div>
    </div>
  );
}
