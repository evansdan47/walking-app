import { AdminCategories } from '@/components/admin/admin-categories';
import { AdminShell } from '@/components/admin/admin-shell';

export default function AdminBadgeCategoriesPage() {
  return (
    <AdminShell title="Badge categories">
      <AdminCategories />
    </AdminShell>
  );
}
