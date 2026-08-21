import { AppShell } from "@/components/AppShell";
import { RoomView } from "@/components/spatial/RoomView";

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const roomId = (await params).roomId;
  const resolvedSearchParams = await searchParams;
  const locateHotspot = typeof resolvedSearchParams.locateHotspot === 'string' ? resolvedSearchParams.locateHotspot : undefined;

  return (
    <>
      <RoomView roomId={roomId} locateHotspotId={locateHotspot} />
    </>
  );
}
