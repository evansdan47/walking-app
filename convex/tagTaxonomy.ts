import type { Doc } from './_generated/dataModel';

type TagSeed = Omit<Doc<'tagDefinitions'>, '_id' | '_creationTime'>;

function tag(
  slug: string,
  category: TagSeed['category'],
  kind: TagSeed['kind'],
  label: string,
  sortOrder: number,
  extra?: Partial<Pick<TagSeed, 'description' | 'autoDetectRule' | 'seasonalMonths'>>,
): TagSeed {
  return {
    slug,
    category,
    kind,
    label,
    sortOrder,
    isActive: true,
    ...extra,
  };
}

/**
 * MVP controlled vocabulary — expand via seedTagDefinitions (admin).
 * @see docs/taggingsystem.md
 */
export const TAG_TAXONOMY_SEED: TagSeed[] = [
  // Landscape
  tag('landscape.coastal', 'landscape', 'objective', 'Coastal', 10, { autoDetectRule: 'land_cover.coastal' }),
  tag('landscape.beach', 'landscape', 'objective', 'Beach', 20),
  tag('landscape.woodland', 'landscape', 'objective', 'Woodland', 30),
  tag('landscape.forest', 'landscape', 'objective', 'Forest', 40),
  tag('landscape.river', 'landscape', 'objective', 'River', 50),
  tag('landscape.canal', 'landscape', 'objective', 'Canal', 60),
  tag('landscape.lake', 'landscape', 'objective', 'Lake', 70),
  tag('landscape.moorland', 'landscape', 'objective', 'Moorland', 80),
  tag('landscape.countryside', 'landscape', 'objective', 'Countryside', 90),
  tag('landscape.valley', 'landscape', 'objective', 'Valley', 100),
  tag('landscape.mountain', 'landscape', 'objective', 'Mountain', 110),
  tag('landscape.urban', 'landscape', 'objective', 'Urban', 120),
  tag('landscape.parkland', 'landscape', 'objective', 'Parkland', 130),

  // Terrain
  tag('terrain.flat', 'terrain', 'objective', 'Flat', 10, { autoDetectRule: 'stats.grade_flat' }),
  tag('terrain.gentle_rolling', 'terrain', 'objective', 'Gentle rolling', 20),
  tag('terrain.hilly', 'terrain', 'objective', 'Hilly', 30, { autoDetectRule: 'stats.grade_hilly' }),
  tag('terrain.steep', 'terrain', 'objective', 'Steep', 40),
  tag('terrain.mountainous', 'terrain', 'objective', 'Mountainous', 50, { autoDetectRule: 'stats.grade_mountainous' }),
  tag('terrain.rocky', 'terrain', 'objective', 'Rocky', 60),
  tag('terrain.sandy', 'terrain', 'objective', 'Sandy', 70),
  tag('terrain.boggy', 'terrain', 'objective', 'Boggy', 80),
  tag('terrain.muddy', 'terrain', 'seasonal', 'Muddy', 90),
  tag('terrain.uneven', 'terrain', 'objective', 'Uneven', 100),
  tag('terrain.scrambling', 'terrain', 'objective', 'Scrambling', 110),

  // Path type
  tag('path_type.footpath', 'path_type', 'objective', 'Footpath', 10),
  tag('path_type.bridleway', 'path_type', 'objective', 'Bridleway', 20),
  tag('path_type.gravel_track', 'path_type', 'objective', 'Gravel track', 30),
  tag('path_type.farm_track', 'path_type', 'objective', 'Farm track', 40),
  tag('path_type.dirt_trail', 'path_type', 'objective', 'Dirt trail', 50),
  tag('path_type.paved', 'path_type', 'objective', 'Paved', 60),
  tag('path_type.boardwalk', 'path_type', 'objective', 'Boardwalk', 70),
  tag('path_type.beach_walking', 'path_type', 'objective', 'Beach walking', 80),

  // Route style
  tag('route_style.circular', 'route_style', 'objective', 'Circular', 10, { autoDetectRule: 'geometry.circular' }),
  tag('route_style.out_and_back', 'route_style', 'objective', 'Out and back', 20, { autoDetectRule: 'geometry.out_and_back' }),
  tag('route_style.point_to_point', 'route_style', 'objective', 'Point to point', 30, { autoDetectRule: 'geometry.point_to_point' }),
  tag('route_style.linear', 'route_style', 'objective', 'Linear', 40),

  // Difficulty
  tag('difficulty.easy', 'difficulty', 'objective', 'Easy', 10, { autoDetectRule: 'stats.grade_easy' }),
  tag('difficulty.moderate', 'difficulty', 'objective', 'Moderate', 20, { autoDetectRule: 'stats.grade_moderate' }),
  tag('difficulty.hard', 'difficulty', 'objective', 'Hard', 30),
  tag('difficulty.challenging', 'difficulty', 'objective', 'Challenging', 40),
  tag('difficulty.expert', 'difficulty', 'objective', 'Expert', 50),

  // Facilities
  tag('facilities.parking', 'facilities', 'objective', 'Parking', 10),
  tag('facilities.free_parking', 'facilities', 'objective', 'Free parking', 20),
  tag('facilities.paid_parking', 'facilities', 'objective', 'Paid parking', 30),
  tag('facilities.toilets', 'facilities', 'objective', 'Toilets', 40),
  tag('facilities.cafe', 'facilities', 'objective', 'Café', 50),
  tag('facilities.pub', 'facilities', 'objective', 'Pub', 60),
  tag('facilities.visitor_centre', 'facilities', 'objective', 'Visitor centre', 70),
  tag('facilities.public_transport', 'facilities', 'objective', 'Public transport', 80),

  // Features
  tag('features.great_views', 'features', 'subjective', 'Great views', 10),
  tag('features.waterfall', 'features', 'objective', 'Waterfall', 20),
  tag('features.historic_site', 'features', 'objective', 'Historic site', 30),
  tag('features.wildlife', 'features', 'subjective', 'Wildlife', 40),
  tag('features.nature_reserve', 'features', 'objective', 'Nature reserve', 50),
  tag('features.peaceful', 'features', 'subjective', 'Peaceful', 60),

  // Accessibility
  tag('accessibility.wheelchair_friendly', 'accessibility', 'subjective', 'Wheelchair friendly', 10),
  tag('accessibility.pushchair_friendly', 'accessibility', 'subjective', 'Pushchair friendly', 20),
  tag('accessibility.child_friendly', 'accessibility', 'subjective', 'Child friendly', 30),
  tag('accessibility.step_free', 'accessibility', 'objective', 'Step free', 40),

  // Dog
  tag('dog.dog_friendly', 'dog', 'subjective', 'Dog friendly', 10),
  tag('dog.dogs_on_lead', 'dog', 'objective', 'Dogs on lead', 20),
  tag('dog.off_lead_suitable', 'dog', 'subjective', 'Off lead suitable', 30),
  tag('dog.livestock_present', 'dog', 'seasonal', 'Livestock present', 40),
  tag('dog.water_available', 'dog', 'objective', 'Water available', 50),

  // Seasonal
  tag('seasonal.bluebells', 'seasonal', 'seasonal', 'Bluebells', 10, { seasonalMonths: [4, 5] }),
  tag('seasonal.autumn_colours', 'seasonal', 'seasonal', 'Autumn colours', 20, { seasonalMonths: [9, 10, 11] }),
  tag('seasonal.winter_friendly', 'seasonal', 'seasonal', 'Winter friendly', 30, { seasonalMonths: [11, 12, 1, 2] }),
  tag('seasonal.overgrown', 'seasonal', 'seasonal', 'Overgrown', 40),
  tag('seasonal.flood_risk', 'seasonal', 'seasonal', 'Flood risk', 50),

  // Hazards
  tag('hazards.exposed_cliffs', 'hazards', 'objective', 'Exposed cliffs', 10),
  tag('hazards.steep_drops', 'hazards', 'objective', 'Steep drops', 20),
  tag('hazards.river_crossing', 'hazards', 'objective', 'River crossing', 30),
  tag('hazards.road_sections', 'hazards', 'objective', 'Road sections', 40),
  tag('hazards.scrambling_required', 'hazards', 'objective', 'Scrambling required', 50),
  tag('hazards.tidal_route', 'hazards', 'objective', 'Tidal route', 60),
];
