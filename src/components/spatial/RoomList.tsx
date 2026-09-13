"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRooms, createRoom, Room, deleteRoom } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";
import { useNetworkState } from "@/hooks/useNetworkState";

export function RoomList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const router = useRouter();
  const { isOnline } = useNetworkState();

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const data = await getRooms();
      setRooms(data);
    } catch (err) {
      console.error("Failed to load rooms", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    
    setIsCreating(true);
    let newRoomId = "";
    try {
      const newRoom = await createRoom(newRoomName.trim());
      newRoomId = newRoom.id;
    } catch (err) {
      console.error("Failed to create room", err);
      setIsCreating(false);
    }
    
    if (newRoomId) {
      router.push(`/rooms/${newRoomId}`);
    }
  };

  const handleDeleteRoom = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the room "${name}"? This will recursively delete all views, hotspots, and remove components stored within it.`)) return;
    
    try {
      await deleteRoom(id);
      setRooms(rooms.filter(r => r.id !== id));
    } catch (err) {
      console.error("Failed to delete room", err);
      alert("Failed to delete room");
    }
  };

  if (isLoading) return <div className="text-brand-text-muted">Loading rooms...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {rooms.map((room) => (
        <div 
          key={room.id} 
          onClick={() => router.push(`/rooms/${room.id}`)}
          className="bg-[#1a1816] border border-[#332f2a] hover:border-brand-accent p-6 rounded-lg text-left transition-all flex items-center justify-between group cursor-pointer shadow-sm hover:shadow-md min-h-[84px]"
        >
          <div className="min-w-0 pr-4">
            <span className="font-serif text-xl font-bold text-white group-hover:text-brand-accent transition-colors truncate block">
              {room.name}
            </span>
          </div>
          {isOnline && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteRoom(room.id, room.name);
              }}
              className="p-2 text-brand-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100 shrink-0"
              data-tooltip={`Delete room "${room.name}"`}
              data-tooltip-variant="danger"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
      ))}

      {/* Create Room Form */}
      <div className="bg-[#1a1816] border border-dashed border-[#332f2a] p-6 rounded-lg relative flex flex-col justify-center min-h-[84px]">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <label className="text-[10px] tracking-widest text-brand-text-muted uppercase font-medium">
            Create New Room
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="e.g. Workshop, Garage"
              className="flex-1 bg-brand-bg border border-[#332f2a] px-3 py-2 text-sm text-white focus:border-brand-accent focus:outline-none rounded-sm transition-colors"
              disabled={isCreating}
            />
            <button 
              type="submit" 
              disabled={isCreating || !newRoomName.trim()}
              className="bg-[#24211e] hover:bg-brand-accent hover:text-white disabled:opacity-50 text-brand-text p-2 rounded-sm transition-colors shrink-0"
              data-tooltip="Add Room"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
