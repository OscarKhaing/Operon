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
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/users", label: "Clients", icon: Users },
  { href: "/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/hotels", label: "Hotels", icon: Building2 },
  { href: "/flights", label: "Flights", icon: Plane },
  { href: "/restaurants", label: "Restaurants", icon: UtensilsCrossed },
];

export default function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 h-screen bg-[#0f172a] text-white flex flex-col z-30 shadow-xl transition-all duration-300",
      )}
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center gap-2 px-5 border-b border-white/10 overflow-hidden">
        <Plane className="w-5 h-5 text-sky-400 flex-shrink-0" />
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight uppercase whitespace-nowrap">Operon</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200",
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                active
                  ? "bg-sky-500/20 text-sky-400 shadow-inner"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className={cn("w-[18px] h-[18px] flex-shrink-0", active ? "text-sky-400" : "text-slate-500")} />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center gap-2 px-3 py-3 border-t border-white/10 text-slate-500 hover:text-white transition-colors"
      >
        {collapsed ? (
          <ChevronsRight className="w-4 h-4" />
        ) : (
          <>
            <ChevronsLeft className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-widest font-semibold">Collapse</span>
          </>
        )}
      </button>
    </aside>
  );
}
