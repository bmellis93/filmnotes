"use client";

type Thumb = {
  url: string;
  alt?: string;
};

type Props = {
  thumbs: Thumb[];
  className?: string;
};

export default function GalleryCover({ thumbs, className }: Props) {
  const t = thumbs.slice(0, 4);

  return (
    <div
      className={[
        "relative w-full overflow-hidden rounded-t-2xl bg-[var(--surface-1)]",
        "transition-transform duration-200 will-change-transform",
        "group-hover:scale-[1.01]",
        className ?? "",
      ].join(" ")}
      style={{ aspectRatio: "16 / 9" }}
    >
      {t.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)] text-sm">
          No videos yet
        </div>
      )}

      {t.length === 1 && (
        <Tile url={t[0].url} alt={t[0].alt} className="absolute inset-0" />
      )}

      {t.length === 2 && (
        <div className="absolute inset-0 grid grid-cols-2 gap-[2px] bg-[var(--surface-0)]">
          <Tile url={t[0].url} alt={t[0].alt} />
          <Tile url={t[1].url} alt={t[1].alt} />
        </div>
      )}

      {t.length >= 3 && (
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[2px] bg-[var(--surface-0)]">
          <Tile url={t[0].url} alt={t[0].alt} />
          <Tile url={t[1].url} alt={t[1].alt} />
          <Tile url={t[2].url} alt={t[2].alt} />
          {t[3] ? <Tile url={t[3].url} alt={t[3].alt} /> : <div className="bg-[var(--surface-1)]" />}
        </div>
      )}

      {/* Overlay */}
      <div
        className={[
          "pointer-events-none absolute inset-0",
          "opacity-0 transition-opacity duration-200",
          "group-hover:opacity-100",
          "bg-gradient-to-t from-black/55 via-black/20 to-transparent",
        ].join(" ")}
      />
    </div>
  );
}

function Tile({ url, alt, className }: { url: string; alt?: string; className?: string }) {
  return (
    <div className={["relative overflow-hidden bg-[var(--surface-1)]", className ?? ""].join(" ")}>
      <img
        src={url}
        alt={alt ?? "Video thumbnail"}
        className={[
          "absolute inset-0 h-full w-full object-contain",
          "transition-transform duration-200 will-change-transform",
          "group-hover:scale-[1.03]",
        ].join(" ")}
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}