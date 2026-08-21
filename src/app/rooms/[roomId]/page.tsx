import { AppShell } from "@/components/AppShell";
import { RoomView } from "@/components/spatial/RoomView";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const roomId = (await params).roomId;

  return (
    <AppShell>
      <RoomView roomId={roomId} />
    </AppShell>
  );
}
