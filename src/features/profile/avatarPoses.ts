// The profile pictures the person can choose from: the MONO fox in nine poses (assets/mascot/fox_poses). The
// choice is one local setting (`avatar_pose`, the pose's id); nothing is derived or stored elsewhere. No choice, or
// an id this version does not know (a restored backup from a later one), means the default avatar.
import { AVATAR_POSE_SETTING } from './avatarSetting';

export { AVATAR_POSE_SETTING };

export type AvatarPoseId =
  | 'sunglasses'
  | 'glasses'
  | 'money_eyes'
  | 'headphones'
  | 'thinking'
  | 'checking_portfolio'
  | 'thumbs_up'
  | 'saving_money'
  | 'hoodie_on';

export interface AvatarPose {
  id: AvatarPoseId;
  source: number; // a bundled image, as `require` gives it
}

/* eslint-disable @typescript-eslint/no-require-imports -- bundled assets must be required statically */
export const AVATAR_POSES: readonly AvatarPose[] = [
  { id: 'sunglasses', source: require('@/assets/mascot/fox_poses/fox_poses/01_sunglasses.png') },
  { id: 'glasses', source: require('@/assets/mascot/fox_poses/fox_poses/02_glasses.png') },
  { id: 'money_eyes', source: require('@/assets/mascot/fox_poses/fox_poses/03_money_eyes.png') },
  { id: 'headphones', source: require('@/assets/mascot/fox_poses/fox_poses/04_headphones.png') },
  { id: 'thinking', source: require('@/assets/mascot/fox_poses/fox_poses/05_thinking.png') },
  { id: 'checking_portfolio', source: require('@/assets/mascot/fox_poses/fox_poses/06_checking_portfolio.png') },
  { id: 'thumbs_up', source: require('@/assets/mascot/fox_poses/fox_poses/07_thumbs_up.png') },
  { id: 'saving_money', source: require('@/assets/mascot/fox_poses/fox_poses/08_saving_money.png') },
  { id: 'hoodie_on', source: require('@/assets/mascot/fox_poses/fox_poses/09_hoodie_on.png') },
];
/* eslint-enable @typescript-eslint/no-require-imports */

export function poseById(id: string | null | undefined): AvatarPose | null {
  return AVATAR_POSES.find(p => p.id === id) ?? null;
}
