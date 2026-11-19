// The chosen profile picture: read as one setting, saved as one setting. Every write calls invalidateAfterWrite,
// which refreshes this read together with the rest.
import { useQuery } from '@tanstack/react-query';

import { useDb } from '@/data/db/DbProvider';
import type { Db } from '@/data/db/types';
import { queryKeys } from '@/data/queryKeys';
import { getSetting, setSetting } from '@/data/repo/settings';

import { AVATAR_POSE_SETTING, poseById, type AvatarPoseId } from './avatarPoses';

// null: the default avatar (nothing chosen, or an id this version does not know).
export async function readAvatarPose(db: Db): Promise<AvatarPoseId | null> {
  return poseById(await getSetting(db, AVATAR_POSE_SETTING))?.id ?? null;
}

export async function saveAvatarPose(db: Db, id: AvatarPoseId | null): Promise<void> {
  await setSetting(db, AVATAR_POSE_SETTING, id ?? '');
}

export function useAvatarPose(): AvatarPoseId | null {
  const db = useDb();
  const { data } = useQuery({ queryKey: [...queryKeys.settings, 'avatar-pose'], queryFn: () => readAvatarPose(db), staleTime: 0 });
  return data ?? null;
}
