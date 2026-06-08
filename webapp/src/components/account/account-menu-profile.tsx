'use client';

import { BetaBadge } from '@/components/account/beta-badge';
import { UserAvatar, useUserDisplay } from '@/components/account/user-avatar';
import { presetToProfileFile, validateAvatarFile } from '@/lib/avatar-upload';
import { RAMBLEIO_AVATAR_PRESETS } from '@/lib/rambleio-avatars';
import { api } from '@convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

function splitDisplayName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

export function AccountMenuProfile() {
  const { user } = useUser();
  const { email } = useUserDisplay();
  const accountSummary = useQuery(api.users.getAccountSummary);
  const updateProfile = useMutation(api.users.updateProfile);

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.fullName ?? user.firstName ?? accountSummary?.name ?? '');
    }
  }, [user, accountSummary?.name]);

  async function applyProfileImage(file: File) {
    if (!user) return;
    const validationError = validateAvatarFile(file);
    if (validationError) {
      setAvatarError(validationError);
      return;
    }

    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await user.setProfileImage({ file });
      await user.reload();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Could not update avatar');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handlePresetSelect(presetId: string, src: string) {
    setSelectedPresetId(presetId);
    try {
      const file = await presetToProfileFile(src, presetId);
      await applyProfileImage(file);
    } catch {
      setAvatarError('Could not apply this avatar. Try again or upload your own.');
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSelectedPresetId(null);
    await applyProfileImage(file);
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setSaved(false);
    setSaveError(null);

    const trimmed = name.trim();
    const { firstName, lastName } = splitDisplayName(trimmed);

    try {
      await user.update({ firstName, lastName });
      await updateProfile({ name: trimmed || undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Profile</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Your avatar syncs across devices via your account.
        </p>
      </div>

      {/* Avatar preview */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <UserAvatar size="lg" className="ring-2 ring-white shadow-md" />
          {avatarBusy && (
            <div className="absolute inset-0 rounded-full bg-white/70 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <BetaBadge />
          </div>
          <p className="text-xs text-gray-500 mt-1">Pick a Rambleio icon or upload your own photo.</p>
        </div>
      </div>

      {avatarError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
          {avatarError}
        </p>
      )}

      {/* Preset avatars */}
      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">Rambleio icons</p>
        <div className="grid grid-cols-3 gap-2">
          {RAMBLEIO_AVATAR_PRESETS.map((preset) => {
            const selected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={avatarBusy}
                onClick={() => void handlePresetSelect(preset.id, preset.src)}
                className={`flex flex-col items-center gap-1 rounded-lg p-2 border transition-colors disabled:opacity-50 ${
                  selected
                    ? 'border-brand bg-orange-50 ring-1 ring-brand/30'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                title={preset.label}
              >
                <Image
                  src={preset.src}
                  alt=""
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full"
                />
                <span className="text-[10px] text-gray-600 truncate w-full text-center">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom upload */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => void handleFileChange(e)}
        />
        <button
          type="button"
          disabled={avatarBusy}
          onClick={() => fileInputRef.current?.click()}
          className="w-full text-sm font-medium text-brand border-2 border-brand/30 hover:border-brand hover:bg-orange-50 disabled:opacity-50 rounded-lg px-3 py-2.5 transition-colors"
        >
          Upload your own image
        </button>
        <p className="text-[10px] text-gray-400 mt-1.5">JPEG, PNG, WebP or GIF · max 5 MB</p>
      </div>

      {/* Name & email */}
      <form onSubmit={(e) => void handleSaveName(e)} className="space-y-4 pt-1 border-t border-gray-100">
        <div>
          <label htmlFor="account-display-name" className="block text-xs font-medium text-gray-700 mb-1.5">
            Display name
          </label>
          <input
            id="account-display-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={80}
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:border-brand focus:bg-white focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label htmlFor="account-email" className="block text-xs font-medium text-gray-700 mb-1.5">
            Email
          </label>
          <input
            id="account-email"
            type="email"
            value={email}
            readOnly
            className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
          />
          <p className="text-[10px] text-gray-400 mt-1">Email is managed by your sign-in provider.</p>
        </div>

        {saveError && (
          <p className="text-xs text-red-600" role="alert">{saveError}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !user}
            className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save name'}
          </button>
          {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
        </div>
      </form>
    </div>
  );
}
