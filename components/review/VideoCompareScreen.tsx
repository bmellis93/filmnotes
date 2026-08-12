"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import VideoCompareView from "./VideoCompareView";

type CompareVersion = {
  id: string;
  label: string; // "v1", "v2", ...
};

type Props = {
  baseVideoId: string;        // any id from the stack you’re comparing within
  versions: CompareVersion[]; // ordered versions
  defaultLeftId?: string;
  defaultRightId?: string;
  shareAuthToken?: string | null;
};

export default function VideoCompareScreen({
  baseVideoId,
  versions,
  defaultLeftId,
  defaultRightId,
  shareAuthToken,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Defensive: nothing to compare
  if (!versions.length) return null;

  const validIds = useMemo(
    () => new Set(versions.map((v) => v.id)),
    [versions]
  );

  const leftFromUrl = searchParams.get("left");
  const rightFromUrl = searchParams.get("right");

  function resolveId(
    candidate: string | null | undefined,
    fallback: string | undefined
  ) {
    if (candidate && validIds.has(candidate)) return candidate;
    if (fallback && validIds.has(fallback)) return fallback;
    return versions[0].id ?? baseVideoId;
  }

  let leftVersionId = resolveId(leftFromUrl, defaultLeftId);
  let rightVersionId = resolveId(rightFromUrl, defaultRightId);

  // If both sides resolve to the same version, try to split them
  if (leftVersionId === rightVersionId && versions.length > 1) {
    const alternate = versions.find((v) => v.id !== leftVersionId);
    if (alternate) rightVersionId = alternate.id;
  }

  function replaceParams(nextLeft: string, nextRight: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("left", nextLeft);
    params.set("right", nextRight);

    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <VideoCompareView
      leftVersionId={leftVersionId}
      rightVersionId={rightVersionId}
      versions={versions}
      onChangeLeft={(id) => replaceParams(id, rightVersionId)}
      onChangeRight={(id) => replaceParams(leftVersionId, id)}
      shareAuthToken={shareAuthToken}
    />
  );
}