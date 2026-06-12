import { AdminBadgeEditor } from '@/components/admin/admin-badge-editor';
import { AdminShell } from '@/components/admin/admin-shell';

export default function AdminNewBadgePage() {
  return (
    <AdminShell title="New badge">
      <AdminBadgeEditor />
    </AdminShell>
  );
}
