"use client";

import type { BountyStatus } from "@/lib/contracts/types";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/format";
import { Badge } from "./ui/badge";

export function StatusBadge({ status }: { status: BountyStatus }) {
  return (
    <Badge
      variant="outline"
      className={STATUS_STYLES[status] || STATUS_STYLES.Open}
    >
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}
