import ClientGalleryScreen from "@/components/share/ClientGalleryScreen";
import SharePasswordGate from "@/components/share/SharePasswordGate";
import { fetchShare } from "@/lib/share/fetchShare";
import { unlockCookieName } from "@/lib/share/sharePassword";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shareId: string }>;
};

export default async function ShareGalleryPage({ params }: Props) {
  const { shareId } = await params;
  const unlockProof = (await cookies()).get(unlockCookieName(shareId))?.value ?? null;
  const result = await fetchShare(shareId, unlockProof);
  if (!result.ok) {
    if (result.passwordRequired) return <SharePasswordGate token={shareId} />;
    notFound();
  }
  const share = result.share;

  return (
    <ClientGalleryScreen
      shareId={share.shareId}
      title={share.title}
      videos={share.videos}
      stacks={share.stacks}
      permissions={share.permissions}
    />
  );
}