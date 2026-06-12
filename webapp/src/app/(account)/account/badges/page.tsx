import { BadgeGallery } from '@/components/badges/badge-gallery';
import { AccountPageShell } from '@/components/account/account-page-shell';

export default function AccountBadgesPage() {
  return (
    <AccountPageShell title="Rambleio" showMapLink={false}>
      <BadgeGallery variant="page" />
    </AccountPageShell>
  );
}
