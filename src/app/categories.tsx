// Placeholder until this screen is built: keeps the route real, so the row on More lands on a
// screen whose back arrow returns to More (no tab bar here).
import { ComingSoonScreen } from '@/components/ComingSoonScreen';
import { moreCategoriesTitle, moreComingSoon } from '@/i18n';

export default function Screen() {
  return <ComingSoonScreen title={moreCategoriesTitle()} message={moreComingSoon()} />;
}
