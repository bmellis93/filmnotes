import { Suspense } from "react";
import SearchScreen from "@/components/owner/SearchScreen";

export default function OwnerSearchPage() {
  // SearchScreen reads ?q= via useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <SearchScreen />
    </Suspense>
  );
}
