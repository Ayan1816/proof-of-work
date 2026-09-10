"use client";

import { PageShell } from "@/components/PageShell";
import { ProfileView } from "@/components/ProfileView";
import { useWallet } from "@/lib/genlayer/wallet";

export default function MyProfilePage() {
  const { address, isConnected, isLoading } = useWallet();

  return (
    <PageShell>
      <ProfileView
        address={isConnected ? address : null}
        isOwn
        walletLoading={isLoading}
      />
    </PageShell>
  );
}
