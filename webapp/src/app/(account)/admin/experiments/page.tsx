import { AdminExperiments } from '@/components/admin/admin-experiments';
import { AdminShell } from '@/components/admin/admin-shell';

export default function AdminExperimentsPage() {
  return (
    <AdminShell title="Experiments">
      <AdminExperiments />
    </AdminShell>
  );
}
