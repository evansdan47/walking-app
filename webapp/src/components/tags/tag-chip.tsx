'use client';

type TagChipProps = {
  label: string;
  selected?: boolean;
  suggested?: boolean;
  disabled?: boolean;
  count?: number;
  kind?: 'objective' | 'subjective' | 'seasonal';
  onClick?: () => void;
  size?: 'sm' | 'md';
};

export function TagChip({
  label,
  selected = false,
  suggested = false,
  disabled = false,
  count,
  kind,
  onClick,
  size = 'sm',
}: TagChipProps) {
  const isInteractive = onClick !== undefined && !disabled;
  const padding = size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5';
  const text = size === 'sm' ? 'text-[11px]' : 'text-xs';

  let suffix = '';
  if (count !== undefined && count > 0 && kind === 'subjective') {
    suffix = ` · ${count} walker${count !== 1 ? 's' : ''}`;
  } else if (count !== undefined && count > 0) {
    suffix = ` (${count})`;
  }

  return (
    <button
      type="button"
      disabled={!isInteractive}
      onClick={onClick}
      className={[
        'inline-flex items-center rounded-full font-medium transition-colors',
        padding,
        text,
        isInteractive ? 'cursor-pointer' : 'cursor-default',
        selected
          ? 'bg-brand text-white shadow-sm'
          : suggested
            ? 'bg-brand/10 text-brand ring-1 ring-brand/30 hover:bg-brand/15'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
      aria-pressed={isInteractive ? selected : undefined}
    >
      {label}
      {suffix ? <span className={selected ? 'opacity-90' : 'opacity-70'}>{suffix}</span> : null}
    </button>
  );
}

type TagChipListItem = {
  id: string;
  label: string;
  kind?: 'objective' | 'subjective' | 'seasonal';
  count?: number;
  suggested?: boolean;
};

type TagChipListProps = {
  items: TagChipListItem[];
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  size?: 'sm' | 'md';
};

export function TagChipList({ items, selectedIds, onToggle, size = 'sm' }: TagChipListProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <TagChip
          key={item.id}
          label={item.label}
          kind={item.kind}
          count={item.count}
          suggested={item.suggested}
          selected={selectedIds?.has(item.id)}
          onClick={onToggle ? () => onToggle(item.id) : undefined}
          size={size}
        />
      ))}
    </div>
  );
}
