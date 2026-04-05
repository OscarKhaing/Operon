"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { Search, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

// Flexible interface to handle both API strings and JSON object exports
// Updated simplified interface for UsersPage.tsx
interface User {
  _id: string; // Guaranteed string by transformUser
  fullName: string;
  email: string;
  phone: string;
  nationality: string;
  passportNumber: string;
  insta_tag: string;
  birthday: string;
  previousTrip?: {
    destination: string;
    date: string;
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch users:", err);
        setLoading(false);
      });
  }, []);

  // Helper to extract ID or Date regardless of format
  const getValue = (val: any, key: string) => {
    if (!val) return null;
    return typeof val === "object" ? val[key] : val;
  };

  const filtered = users.filter((u) => {
    const searchLower = search.toLowerCase();
    return (
      !search ||
      u.fullName?.toLowerCase().includes(searchLower) ||
      u.email?.toLowerCase().includes(searchLower) ||
      u.nationality?.toLowerCase().includes(searchLower) ||
      u.passportNumber?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Header title="Clients" />

      <div className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-6 py-4 font-semibold text-gray-600">Client</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Nationality</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Passport</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Last Trip</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Social</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center text-gray-400">Loading clients...</td></tr>
              ) : filtered.map((user) => {
                const uid = getValue(user._id, "$oid");
                const bday = getValue(user.birthday, "$date");
                const tripDate = getValue(user.previousTrip?.date, "$date");

                return (
                  <tr key={uid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center">
                          <UserIcon size={16} />
                        </div>
                        <div>
                          <Link href={`/users/${uid}`} className="font-medium text-gray-900 hover:text-sky-600 block">
                            {user.fullName}
                          </Link>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{user.nationality}</td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                        {user.passportNumber || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.previousTrip ? (
                        <div>
                          <div className="text-gray-900">{user.previousTrip.destination}</div>
                          <div className="text-xs text-gray-400">{formatDate(tripDate)}</div>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sky-600 font-medium cursor-pointer hover:underline">
                        @{user.insta_tag}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="py-20 text-center text-gray-400">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}