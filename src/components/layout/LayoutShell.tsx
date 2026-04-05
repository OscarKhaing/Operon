"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

/**
 * Conditionally renders the sidebar + admin margin.
 * Customer-facing pages (/book) get a full-width layout with no sidebar.
 */
export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCustomerPage = pathname === "/book" || pathname === "/";
  const [collapsed, setCollapsed] = useState(false);

  if (isCustomerPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main
        className="min-h-screen transition-all duration-300"
        style={{ marginLeft: collapsed ? 64 : 240 }}
      >
        {children}
      </main>
    </>
  );
}
