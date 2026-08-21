import { AppShell } from "@/components/AppShell";
import { RoomList } from "@/components/spatial/RoomList";

export default function RoomsPage() {
  return (
    <AppShell>
      <div className="max-w-5xl">
        <h1 className="font-serif text-5xl font-bold text-white mb-2 leading-tight">
          Spatial Map
        </h1>
        <p className="text-brand-text-muted text-lg mb-12">
          Select a room to view its components or create a new one.
        </p>
        <RoomList />
      </div>
    </AppShell>
  );
}
