import { AdminReleases } from '@/components/admin/admin-releases';
import { AdminShell } from '@/components/admin/admin-shell';

export default function AdminReleasesPage() {
  return (
    <AdminShell title="Mobile releases">
      <AdminReleases />
    </AdminShell>
  );
}
