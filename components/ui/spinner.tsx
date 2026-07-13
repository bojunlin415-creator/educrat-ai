import { cn } from "@/lib/cn";

export interface SpinnerProps {
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
}

const sizes: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "size-4 border-2",
  md: "size-7 border-[3px]",
  lg: "size-11 border-4",
};

export function Spinner({
  className,
  label = "載入中",
  size = "md",
}: SpinnerProps) {
  return (
    <span
      aria-label={label}
      className={cn(
        "block animate-spin rounded-full border-emerald-700 border-t-transparent",
        sizes[size],
        className,
      )}
      role="status"
    />
  );
}
