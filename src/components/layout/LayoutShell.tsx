"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

/**
 * Conditionally renders the sidebar + admin margin.
 * Customer-facing pages (/book) get a full-width layout with no sidebar.
 */
export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCustomerPage = pathname.startsWith("/book");

  if (isCustomerPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="ml-[240px] min-h-screen">{children}</main>
    </>
  );
}
