import { BookingStatus } from "@/lib/types";
import { statusLabel } from "@/lib/utils";

export default function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`status-${status} inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`}
    >
      {statusLabel(status)}
    </span>
  );
}
