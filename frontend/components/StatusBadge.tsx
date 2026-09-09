"use client";

import type { BountyStatus } from "@/lib/contracts/types";
import { STATUS_STYLES } from "@/lib/format";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { Badge } from "./ui/badge";

export function StatusBadge({ status }: { status: BountyStatus }) {
  const { t } = useI18n();
  return (
    <Badge
      variant="outline"
      className={STATUS_STYLES[status] || STATUS_STYLES.Open}
    >
      {t.status[status]}
    </Badge>
  );
}
