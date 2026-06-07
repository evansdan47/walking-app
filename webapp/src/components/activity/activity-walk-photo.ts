import type { Id } from '@convex/_generated/dataModel';

export type ActivityWalkPhoto = {
  _id: Id<'walkPhotos'>;
  timestamp: number;
  latitude: number;
  longitude: number;
  url: string | null;
  caption?: string;
};
