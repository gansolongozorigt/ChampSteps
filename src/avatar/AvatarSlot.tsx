// src/avatar/AvatarSlot.tsx — the avatar as mounted on the achievements screen
// (flag VITE_AVATAR_DEV=1 only). Listens to the bus (App.tsx emits), keeps
// state in memory only, nothing is written to Firestore.
import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { useAvatar } from "./useAvatar";
import { getLastEnergy, subscribeAvatar } from "./bus";
import { preloadAvatarAssets } from "./assets";

export default function AvatarSlot({ childName, size = 200 }: { childName: string; size?: number }) {
  const { state, dispatch, reducedMotion } = useAvatar();
  const [energy, setEnergy] = useState<number>(() => getLastEnergy());

  useEffect(() => {
    void preloadAvatarAssets();
    return subscribeAvatar((msg) => {
      if (msg.type === "event") dispatch(msg.event);
      else setEnergy(msg.pct);
    });
  }, [dispatch]);

  return (
    <div data-testid="avatar-slot" data-avatar-state={state} style={{ display: "flex", justifyContent: "center", margin: "0 0 16px" }}>
      <Avatar state={state} size={size} energy={energy} reducedMotion={reducedMotion} label={childName} />
    </div>
  );
}
