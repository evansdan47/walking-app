'use client';

import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import Link from 'next/link';
import { useState } from 'react';

export function AdminCategories() {
  const categories = useQuery(api.badgeAdmin.listCategories);
  const upsert = useMutation(api.badgeAdmin.upsertCategory);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    key: '',
    name: '',
    description: '',
    color: '#2E7D32',
    icon: 'award',
    displayOrder: 1,
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  function startNew() {
    setEditing('__new__');
    setForm({
      key: '',
      name: '',
      description: '',
      color: '#2E7D32',
      icon: 'award',
      displayOrder: (categories?.length ?? 0) + 1,
      isActive: true,
    });
  }

  function startEdit(cat: NonNullable<typeof categories>[number]) {
    setEditing(cat.key);
    setForm({
      key: cat.key,
      name: cat.name,
      description: cat.description ?? '',
      color: cat.color,
      icon: cat.icon,
      displayOrder: cat.displayOrder,
      isActive: cat.isActive,
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsert({
        key: form.key.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        color: form.color,
        icon: form.icon.trim() || 'award',
        displayOrder: form.displayOrder,
        isActive: form.isActive,
      });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Badge categories</h1>
          <p className="text-sm text-gray-500 mt-1">Colours and grouping for the gallery.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/badges" className="text-sm text-brand hover:underline">
            ← Badges
          </Link>
          <button
            type="button"
            onClick={startNew}
            className="rounded-lg bg-brand text-white text-sm font-semibold px-3 py-2"
          >
            New category
          </button>
        </div>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-bold">{editing === '__new__' ? 'New category' : `Edit ${form.key}`}</h2>
          {editing === '__new__' && (
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Key</span>
              <input
                required
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
              />
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Colour</span>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="mt-1 h-10 w-full rounded border border-gray-200"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Display order</span>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Icon key</span>
            <input
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand text-white text-sm font-semibold px-3 py-2 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-sm text-gray-600 px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {categories === undefined ? (
        <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {categories.map((cat) => (
            <div key={cat.key} className="flex items-center gap-3 px-4 py-3">
              <span
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                <p className="text-[10px] text-gray-400 font-mono">{cat.key}</p>
              </div>
              <p className="text-xs text-gray-500">{cat.badgeCount} badges</p>
              <button
                type="button"
                onClick={() => startEdit(cat)}
                className="text-xs font-medium text-brand hover:underline"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
