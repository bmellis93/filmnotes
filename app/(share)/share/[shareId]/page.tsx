import ClientGalleryScreen from "@/components/share/ClientGalleryScreen";
import { fetchShare } from "@/lib/share/fetchShare";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shareId: string }>;
};

export default async function ShareGalleryPage({ params }: Props) {
  const { shareId } = await params;
  const share = await fetchShare(shareId);
  if (!share) notFound();

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