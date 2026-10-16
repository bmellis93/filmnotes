"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Film, LayoutGrid, Search, X } from "lucide-react";
import type { OwnerSearchResults } from "@/app/api/owner/search/route";

const DEBOUNCE_MS = 250;

type Props = {
  // "/embed/galleries" inside the GHL embed -- same convention as
  // StorageBreakdownScreen, keeps result links inside the embed's routes.
  basePath?: string;
};

function Thumb({ url, alt, icon: Icon }: { url: string | null; alt: string; icon: typeof Film }) {
  return (
    <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)]">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-full w-full place-items-center text-[var(--text-muted)]">
          <Icon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

function ArchivedBadge() {
  return (
    <span className="shrink-0 rounded-full border border-[var(--border-3)] bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-[var(--text-2)]">
      Archived
    </span>
  );
}

export default function SearchScreen({ basePath = "/owner/galleries" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The query lives in ?q= so Back from a result returns to the same search.
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [results, setResults] = useState<OwnerSearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(() => {
      router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false });
    }, DEBOUNCE_MS);

    if (!q) {
      setResults(null);
      setLoading(false);
      setError(null);
      return () => clearTimeout(timer);
    }

    const controller = new AbortController();
    setLoading(true);
    const fetchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/owner/search?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        setResults((await res.json()) as OwnerSearchResults);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      clearTimeout(fetchTimer);
      controller.abort();
    };
  }, [query, pathname, router]);

  const hasQuery = query.trim().length > 0;
  const noResults = results && results.galleries.length === 0 && results.videos.length === 0;

  return (
    <div className="min-h-[100dvh] bg-[var(--surface-0)] text-[var(--text-1)]">
      <div className="mx-auto w-full max-w-4xl p-5">
        <div className="text-lg font-semibold">Search</div>
        <div className="text-sm text-[var(--text-muted)]">Find galleries and videos by title.</div>

        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2.5 focus-within:border-[var(--border-3)]">
          <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search galleries and videos…"
            aria-label="Search galleries and videos"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-1)] placeholder:text-[var(--text-muted)] outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-6">
          {!hasQuery ? null : error ? (
            <div className="text-sm text-[var(--danger)]">{error}</div>
          ) : !results ? (
            <div className="text-sm text-[var(--text-muted)]">Searching…</div>
          ) : noResults ? (
            <div className="text-sm text-[var(--text-muted)]">
              No galleries or videos match &ldquo;{results.query}&rdquo;.
            </div>
          ) : (
            <div className={["space-y-6 transition-opacity", loading ? "opacity-60" : ""].join(" ")}>
              {results.galleries.length > 0 ? (
                <section>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Galleries · {results.galleries.length}
                  </div>
                  <div className="mt-2 space-y-2">
                    {results.galleries.map((g) => (
                      <Link
                        key={g.id}
                        href={`${basePath}/${g.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/20 p-2 pr-3 hover:bg-[var(--surface-1)]/40"
                      >
                        <Thumb url={g.thumbUrl} alt={g.name} icon={LayoutGrid} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-[var(--text-1)]">{g.name}</div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {g.videoCount} video{g.videoCount === 1 ? "" : "s"}
                          </div>
                        </div>
                        {g.archived ? <ArchivedBadge /> : null}
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              {results.videos.length > 0 ? (
                <section>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Videos · {results.videos.length}
                  </div>
                  <div className="mt-2 space-y-2">
                    {results.videos.map((v) => (
                      <Link
                        key={v.id}
                        href={`${basePath}/${v.galleryId}/videos/${v.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/20 p-2 pr-3 hover:bg-[var(--surface-1)]/40"
                      >
                        <Thumb url={v.thumbUrl} alt={v.title} icon={Film} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-[var(--text-1)]">{v.title}</div>
                          <div className="truncate text-xs text-[var(--text-muted)]">{v.galleryName}</div>
                        </div>
                        {v.archived ? <ArchivedBadge /> : null}
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
