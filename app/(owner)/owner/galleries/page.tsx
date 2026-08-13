// app/(owner)/owner/galleries/page.tsx
import OwnerGalleriesClient from "@/components/owner/OwnerGalleriesClient";
import { requireOwnerContext } from "@/lib/auth/ownerSession";
import { getOwnerGalleriesList } from "@/lib/owner/galleriesData";

export const runtime = "nodejs";

export default async function OwnerGalleriesPage() {
  const owner = await requireOwnerContext();
  const initialGalleries = await getOwnerGalleriesList(owner.orgId);

  return <OwnerGalleriesClient initialGalleries={initialGalleries} />;
}