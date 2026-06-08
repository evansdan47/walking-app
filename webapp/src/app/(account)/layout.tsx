import { noIndexMetadata } from '@/lib/metadata';
import type { Metadata } from 'next';

export const metadata: Metadata = noIndexMetadata;

export default function AccountGroupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
