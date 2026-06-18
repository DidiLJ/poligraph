"use client";

import { DebouncedSearchInput } from "@/components/filters/DebouncedSearchInput";
import { useFilterParams } from "@/hooks/useFilterParams";

interface UrlSearchInputProps {
  /** Current applied value, read from the URL on the server */
  value: string;
  /** URL param to write (default: "search") */
  param?: string;
  /** Navigation mode for the param update (default: "push") */
  mode?: "push" | "replace";
  /** Manual mode: search applies only on submit (default: false) */
  manual?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  label?: string;
  submitLabel?: string;
}

export function UrlSearchInput({
  value,
  param = "search",
  mode = "push",
  manual = false,
  placeholder,
  className,
  id,
  label,
  submitLabel,
}: UrlSearchInputProps) {
  const { updateParams } = useFilterParams();
  return (
    <DebouncedSearchInput
      value={value}
      onSearch={(v) => updateParams({ [param]: v }, { mode })}
      manual={manual}
      placeholder={placeholder}
      className={className}
      id={id}
      label={label}
      submitLabel={submitLabel}
    />
  );
}
