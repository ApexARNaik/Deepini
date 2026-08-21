import { AppShell } from "@/components/AppShell";
import { RoomList } from "@/components/spatial/RoomList";

export default function RoomsPage() {
  return (
    <div className="max-w-5xl p-6">
        <div className="mb-12">
          <h1 className="font-serif text-[28px] font-bold tracking-widest text-white uppercase">Spatial Map</h1>
          <p className="mt-1 text-[10px] tracking-[0.2em] text-brand-gold uppercase">Select a room to view its components or create a new one.</p>
        </div>
        <RoomList />
      </div>
  );
}