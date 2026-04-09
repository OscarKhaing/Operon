"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, User, Plane, RotateCcw } from "lucide-react";

export type ChatPreviewMessage = {
  role: "customer" | "agent";
  content: string;
};

type RenderItem =
  | { kind: "message"; role: "customer" | "agent"; content: string }
  | { kind: "typing" };

const TYPING_MS = 900;
const READ_MS = 1500;
const LOOP_RESET_MS = 4000;

export default function ChatPreview({
  script,
  loop = false,
  className = "",
}: {
  script: ChatPreviewMessage[];
  loop?: boolean;
  className?: string;
}) {
  const [items, setItems] = useState<RenderItem[]>([]);
  const [runId, setRunId] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Drive the scripted playback. Each runId triggers a fresh play-through.
  useEffect(() => {
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const schedule = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timeouts.push(t);
    };

    setItems([]);

    let elapsed = 300;
    script.forEach((msg, i) => {
      if (msg.role === "agent") {
        // show typing dots first
        schedule(() => {
          setItems((prev) => [...prev, { kind: "typing" }]);
        }, elapsed);
        elapsed += TYPING_MS;
        schedule(() => {
          setItems((prev) => {
            const next = prev.slice();
            // replace the last typing entry with the message
            for (let j = next.length - 1; j >= 0; j--) {
              if (next[j].kind === "typing") {
                next[j] = { kind: "message", role: "agent", content: msg.content };
                break;
              }
            }
            return next;
          });
        }, elapsed);
      } else {
        schedule(() => {
          setItems((prev) => [
            ...prev,
            { kind: "message", role: "customer", content: msg.content },
          ]);
        }, elapsed);
      }
      elapsed += READ_MS;
      // small extra pause between messages
      if (i < script.length - 1) elapsed += 200;
    });

    if (loop) {
      schedule(() => {
        setRunId((r) => r + 1);
      }, elapsed + LOOP_RESET_MS);
    }

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [script, loop, runId]);

  // Auto-scroll the messages container as items appear
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items]);

  return (
    <div
      className={
        "rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-900/10 overflow-hidden " +
        className
      }
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* Mock chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#0f172a] rounded-md flex items-center justify-center">
            <Plane className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-extrabold uppercase tracking-wide text-gray-900">
              Operon Chat
            </span>
            <span className="text-[10px] text-gray-400 font-medium">AI travel agent</span>
          </div>
        </div>
        <button
          onClick={() => setRunId((r) => r + 1)}
          className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-gray-700 transition-colors"
          aria-label="Replay animation"
        >
          <RotateCcw className="w-3 h-3" />
          Replay
        </button>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="h-[360px] overflow-y-auto bg-gradient-to-b from-gray-50 to-white px-4 py-5 space-y-3"
      >
        {items.map((item, idx) => {
          if (item.kind === "typing") {
            return (
              <div key={idx} className="flex gap-2 justify-start animate-fadeIn">
                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 mt-auto mb-1 border border-sky-200">
                  <Bot className="w-4 h-4 text-sky-600" />
                </div>
                <div className="bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1">
                  <span className="cp-dot" />
                  <span className="cp-dot" style={{ animationDelay: "0.15s" }} />
                  <span className="cp-dot" style={{ animationDelay: "0.3s" }} />
                </div>
              </div>
            );
          }

          const isCustomer = item.role === "customer";
          return (
            <div
              key={idx}
              className={`flex gap-2 animate-fadeIn ${isCustomer ? "justify-end" : "justify-start"}`}
            >
              {!isCustomer && (
                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 mt-auto mb-1 border border-sky-200">
                  <Bot className="w-4 h-4 text-sky-600" />
                </div>
              )}
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm max-w-[78%] ${
                  isCustomer
                    ? "bg-sky-500 text-white rounded-tr-sm"
                    : "bg-white text-gray-800 border border-gray-100 rounded-tl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap">{item.content}</p>
              </div>
              {isCustomer && (
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-auto mb-1 border border-gray-200">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes cp-fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        :global(.animate-fadeIn) {
          animation: cp-fadeIn 0.28s ease-out;
        }
        @keyframes cp-bounce {
          0%,
          80%,
          100% {
            transform: scale(0.6);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
        :global(.cp-dot) {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background-color: #94a3b8;
          animation: cp-bounce 1s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
