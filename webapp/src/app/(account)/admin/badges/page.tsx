import { AdminBadgesList } from '@/components/admin/admin-badges-list';
import { AdminShell } from '@/components/admin/admin-shell';

export default function AdminBadgesPage() {
  return (
    <AdminShell title="Badges">
      <AdminBadgesList />
    </AdminShell>
  );
}
