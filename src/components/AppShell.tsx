"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Map, 
  Archive, 
  Compass, 
  TriangleAlert, 
  Settings,
  Search,
  Bell,
  User
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Room Map", href: "/rooms", icon: Map },
  { name: "Inventory", href: "/inventory", icon: Archive },
  { name: "Projects", href: "/projects", icon: Compass },
  { name: "Low Stock", href: "/low-stock", icon: TriangleAlert },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex h-screen w-full bg-brand-bg overflow-hidden text-brand-text font-sans">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 flex flex-col bg-[#1a1816] border-r border-[#332f2a]">
        {/* Logo Area */}
        <div className="h-20 flex items-center px-6 border-b border-[#332f2a] shrink-0">
          <div className="flex items-center">
            <div className="bg-brand-accent text-white font-serif font-bold h-8 w-8 flex items-center justify-center mr-3">
              D
            </div>
            <div>
              <div className="font-serif font-bold text-white tracking-widest text-lg leading-none uppercase">Deepini</div>
              <div className="text-[9px] tracking-[0.15em] text-brand-gold mt-1 uppercase font-semibold">Personal Component Archive</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 flex flex-col gap-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-6 py-3 mx-2 text-sm font-medium transition-colors ${
                  isActive 
                    ? "text-brand-accent bg-[#24211e]/50 border-l-2 border-brand-accent rounded-r" 
                    : "text-brand-text-muted hover:text-white hover:bg-[#24211e]/30 border-l-2 border-transparent"
                }`}
              >
                <item.icon className={`mr-4 h-5 w-5 ${isActive ? "text-brand-accent" : "text-brand-text-muted"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>


      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-brand-bg">
        {/* Top Header */}
        <header className="h-20 shrink-0 flex items-center justify-between px-8 border-b border-[#332f2a] bg-brand-bg">
          <div className="flex-1 max-w-2xl flex items-center relative">
            <Search className="h-5 w-5 text-brand-text-muted absolute left-0" />
            <input 
              type="text" 
              placeholder="Search components, tags, notes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none py-2 pl-10 pr-4 text-sm text-white placeholder-brand-text-muted focus:outline-none focus:ring-0"
            />
          </div>
          <div className="flex items-center space-x-6 text-brand-text-muted">
            <button 
              onClick={() => alert("No new notifications")}
              title="Notifications"
              className="hover:text-white transition-colors"
            >
              <Bell className="h-5 w-5" />
            </button>
            <button 
              onClick={() => {
                sessionStorage.removeItem("unlocked");
                window.location.reload();
              }}
              title="Lock Workspace"
              className="h-8 w-8 rounded bg-[#24211e] flex items-center justify-center hover:bg-[#333333] hover:text-brand-accent transition-colors border border-[#332f2a]"
            >
              <User className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          {children}
        </main>
      </div>
    </div>
  );
}
