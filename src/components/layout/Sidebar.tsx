"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  CalendarCheck,
  Building2,
  Plane,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/users", label: "Clients", icon: Users }, // Added Users tab
  { href: "/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/hotels", label: "Hotels", icon: Building2 },
  { href: "/flights", label: "Flights", icon: Plane },
  { href: "/restaurants", label: "Restaurants", icon: UtensilsCrossed },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 h-screen w-[240px] bg-[#0f172a] text-white flex flex-col z-30 shadow-xl">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2 px-5 border-b border-white/10">
        <Plane className="w-5 h-5 text-sky-400" />
        <span className="font-bold text-lg tracking-tight uppercase">Operon</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          // Logic to handle active state for root and sub-routes
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                active
                  ? "bg-sky-500/20 text-sky-400 shadow-inner"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className={cn("w-4.5 h-4.5", active ? "text-sky-400" : "text-slate-500")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10 text-[10px] uppercase tracking-widest text-slate-600 font-semibold">
        Operon v0.1 — Internal
      </div>
    </aside>
  );
}