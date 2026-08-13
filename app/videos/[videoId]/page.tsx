import VideoReviewClient from "@/components/review/VideoReviewScreen";

export default async function VideoPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  return <VideoReviewClient videoId={videoId} />;
}