import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
}

export function Select({
  className,
  error,
  id,
  label,
  options,
  ...props
}: SelectProps) {
  const fallbackId = props.name ? `select-${props.name}` : undefined;
  const selectId = id ?? fallbackId;
  const errorId = selectId ? `${selectId}-error` : undefined;

  return (
    <label className="block font-bold text-emerald-950" htmlFor={selectId}>
      {label}
      <select
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        className={cn(
          "mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-normal text-slate-900 hover:border-emerald-600",
          error && "border-red-500",
          className,
        )}
        id={selectId}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span
          className="mt-1.5 block text-sm font-medium text-red-700"
          id={errorId}
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}
