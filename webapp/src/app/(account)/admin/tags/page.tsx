import { AdminTags } from '@/components/admin/admin-tags';
import { AdminShell } from '@/components/admin/admin-shell';

export default function AdminTagsPage() {
  return (
    <AdminShell title="Tags">
      <AdminTags />
    </AdminShell>
  );
}
