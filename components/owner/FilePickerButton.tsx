"use client";

import { useRef } from "react";

type Props = {
  accept?: string;
  disabled?: boolean;
  label: string;
  onFile: (file: File | null) => void;
  className?: string;
};

const defaultClassName =
  "inline-flex items-center rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm font-semibold text-neutral-100 hover:bg-neutral-800 disabled:opacity-60";

export default function FilePickerButton({
  accept,
  disabled,
  label,
  onFile,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={className ?? defaultClassName}
      >
        {label}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0] ?? null;
          // Reset so choosing the same file again still fires onChange.
          e.currentTarget.value = "";
          onFile(f);
        }}
      />
    </>
  );
}
