"use client";

import Link from "next/link";
import { Bell, User, ExternalLink } from "lucide-react";

export default function Header({ title }: { title: string }) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-20">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-4">
        <Link
          href="/book"
          target="_blank"
          className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Customer view
        </Link>
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell className="w-4.5 h-4.5 text-gray-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center">
            <User className="w-4 h-4 text-sky-600" />
          </div>
          <span className="text-sm font-medium text-gray-700">Alice</span>
        </div>
      </div>
    </header>
  );
}
