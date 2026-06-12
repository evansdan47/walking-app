import { AdminGate } from '@/components/admin/admin-gate';
import { noIndexMetadata } from '@/lib/metadata';
import type { Metadata } from 'next';

export const metadata: Metadata = noIndexMetadata;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
