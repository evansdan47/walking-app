import type { Doc } from '@convex/_generated/dataModel';

export type TagCategory = Doc<'tagDefinitions'>['category'];

export const TAG_CATEGORY_ORDER: TagCategory[] = [
  'landscape',
  'terrain',
  'path_type',
  'route_style',
  'difficulty',
  'facilities',
  'features',
  'accessibility',
  'dog',
  'seasonal',
  'hazards',
];

export const TAG_CATEGORY_LABELS: Record<TagCategory, string> = {
  landscape: 'Landscape',
  terrain: 'Terrain',
  path_type: 'Path type',
  route_style: 'Route style',
  difficulty: 'Difficulty',
  facilities: 'Facilities',
  features: 'Features',
  accessibility: 'Accessibility',
  dog: 'Dog',
  seasonal: 'Seasonal',
  hazards: 'Hazards',
};

export function groupTagsByCategory<T extends { category: TagCategory; sortOrder: number }>(
  tags: T[],
): Array<{ category: TagCategory; label: string; tags: T[] }> {
  const byCategory = new Map<TagCategory, T[]>();
  for (const tag of tags) {
    const list = byCategory.get(tag.category) ?? [];
    list.push(tag);
    byCategory.set(tag.category, list);
  }

  return TAG_CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => ({
    category,
    label: TAG_CATEGORY_LABELS[category],
    tags: (byCategory.get(category) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}
