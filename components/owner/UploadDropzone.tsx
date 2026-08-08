"use client";

import { ReactNode, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

type Props = {
  onFiles: (files: File[]) => void;
};

function toFiles(list: FileList | null): File[] {
  if (!list) return [];
  return Array.from(list).filter(Boolean);
}

export default function UploadDropzone({ onFiles }: Props) {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);

        const files = toFiles(e.dataTransfer.files).filter((f) =>
          f.type.startsWith("video/")
        );

        if (files.length) onFiles(files);
      }}
      className={[
        "rounded-2xl border border-[var(--border-2)] bg-[var(--surface-0)]/30 p-6",
        "transition",
        over ? "ring-2 ring-[var(--accent-solid)]/20 bg-[var(--surface-1)]/20" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-1)] ring-1 ring-[var(--border-1)]">
          <UploadCloud className="h-6 w-6 text-[var(--text-2)]" />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--text-1)]">
            Drag and drop videos here
          </div>
          <div className="text-sm text-[var(--text-muted)]">
            Or use “Upload Video” to pick files.
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadButton({
  onFiles,
  className,
  children,
}: {
  onFiles: (files: File[]) => void;
  className?: string;
  children: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={className}
      >
        {children}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = toFiles(e.currentTarget.files);
          e.currentTarget.value = "";
          onFiles(files);
        }}
      />
    </>
  );
}

UploadDropzone.Button = UploadButton;