import { AdminBadgeEditor } from '@/components/admin/admin-badge-editor';
import { AdminShell } from '@/components/admin/admin-shell';

export default async function AdminEditBadgePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return (
    <AdminShell title="Edit badge">
      <AdminBadgeEditor badgeKey={decodeURIComponent(key)} />
    </AdminShell>
  );
}
