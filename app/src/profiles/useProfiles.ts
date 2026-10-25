// Profiles from SQLite, re-read every time the screen gains focus (edits happen on pushed screens).
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { listProfiles, type Profile } from '../db/profiles';

export function useProfiles(): { profiles: Profile[]; self: Profile | null; reload: () => void } {
  const [profiles, setProfiles] = useState<Profile[]>(() => listProfiles());
  const reload = useCallback(() => setProfiles(listProfiles()), []);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  return { profiles, self: profiles.find((p) => p.isSelf) ?? null, reload };
}
