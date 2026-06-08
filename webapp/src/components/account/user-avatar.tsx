'use client';

import { useUser } from '@clerk/nextjs';
import Image from 'next/image';

type UserAvatarProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

const SIZES = {
  sm: { box: 'w-8 h-8', text: 'text-xs', px: 32 },
  md: { box: 'w-10 h-10', text: 'text-sm', px: 40 },
  lg: { box: 'w-16 h-16', text: 'text-xl', px: 64 },
  xl: { box: 'w-20 h-20', text: 'text-2xl', px: 80 },
} as const;

function initials(name: string | null | undefined, email: string | null | undefined): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
    return name.trim().slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

export function UserAvatar({ size = 'md', className = '' }: UserAvatarProps) {
  const { user, isLoaded } = useUser();
  const dim = SIZES[size];

  if (!isLoaded) {
    return (
      <div
        className={`${dim.box} rounded-full bg-gray-200 animate-pulse shrink-0 ${className}`}
        aria-hidden
      />
    );
  }

  const imageUrl = user?.imageUrl;
  const label = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'User';

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt=""
        width={dim.px}
        height={dim.px}
        className={`${dim.box} rounded-full object-cover shrink-0 border border-gray-200 ${className}`}
        unoptimized
      />
    );
  }

  return (
    <div
      className={`${dim.box} rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center justify-center shrink-0 border border-emerald-200/80 ${dim.text} ${className}`}
      aria-hidden
    >
      {initials(user?.fullName, user?.primaryEmailAddress?.emailAddress)}
    </div>
  );
}

export function useUserDisplay() {
  const { user, isLoaded } = useUser();
  return {
    isLoaded,
    name: user?.fullName ?? user?.firstName ?? 'Walker',
    email: user?.primaryEmailAddress?.emailAddress ?? '',
    imageUrl: user?.imageUrl ?? null,
  };
}
