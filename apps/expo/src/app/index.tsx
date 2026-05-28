import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

import { getSetting } from "@/lib/db";

export default function RootIndex() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    async function check() {
      const onboarded = await getSetting("onboarding_complete");
      setHasOnboarded(onboarded === "true");
    }
    check();
  }, []);

  if (hasOnboarded === null) return null;

  if (!hasOnboarded) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
