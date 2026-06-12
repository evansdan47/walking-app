import { AccountScreen } from '@/components/account/account-screen';
import { BadgesGalleryScreen } from '@/components/badges/badges-gallery-screen';

export default function BadgesScreen() {
  return (
    <AccountScreen title="Badges" scrollable={false}>
      <BadgesGalleryScreen />
    </AccountScreen>
  );
}
