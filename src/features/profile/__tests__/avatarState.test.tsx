import { openTestDb } from '@/data/db/openTestDb';
import { getSetting, setSetting } from '@/data/repo/settings';

import { AVATAR_POSE_SETTING, AVATAR_POSES, poseById } from '../avatarPoses';
import { readAvatarPose, saveAvatarPose } from '../useAvatarPose';

describe('the nine poses', () => {
  test('are distinct, each with a bundled picture', () => {
    expect(AVATAR_POSES).toHaveLength(9);
    expect(new Set(AVATAR_POSES.map(p => p.id)).size).toBe(9);
    for (const pose of AVATAR_POSES) expect(pose.source).toBeTruthy();
  });

  test('an unknown id is no pose, so the default avatar shows', () => {
    expect(poseById('sunglasses')?.id).toBe('sunglasses');
    expect(poseById('from_a_later_version')).toBeNull();
    expect(poseById('')).toBeNull();
    expect(poseById(null)).toBeNull();
  });
});

describe('the choice is one setting', () => {
  test('nothing chosen yet: the default', async () => {
    const db = openTestDb();
    expect(await readAvatarPose(db)).toBeNull();
  });

  test('a saved pose is read back; choosing the default clears it', async () => {
    const db = openTestDb();
    await saveAvatarPose(db, 'thumbs_up');
    expect(await getSetting(db, AVATAR_POSE_SETTING)).toBe('thumbs_up');
    expect(await readAvatarPose(db)).toBe('thumbs_up');
    await saveAvatarPose(db, null);
    expect(await getSetting(db, AVATAR_POSE_SETTING)).toBe('');
    expect(await readAvatarPose(db)).toBeNull();
  });

  test('an id this version does not know reads as the default (a restored backup from a later version)', async () => {
    const db = openTestDb();
    await setSetting(db, AVATAR_POSE_SETTING, 'astronaut');
    expect(await readAvatarPose(db)).toBeNull();
  });
});
