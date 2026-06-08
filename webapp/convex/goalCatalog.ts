/**
 * Data-driven goal catalog — add categories, presets, and challenges here.
 * @see docs/goals.md
 */

export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime';

export type GoalCategoryId =
  | 'distance'
  | 'walk_count'
  | 'duration'
  | 'elevation'
  | 'streak'
  | 'route_planning'
  | 'virtual_journey'
  | 'climb_challenge';

export type GoalMetric =
  | 'distanceMetres'
  | 'walkCount'
  | 'movingTimeSeconds'
  | 'elevationGainMetres'
  | 'streakDays'
  | 'plannedRouteCount';

export type GoalUnit = 'km' | 'walks' | 'seconds' | 'metres' | 'routes' | 'days';

export type GoalType =
  | 'distance'
  | 'walk_count'
  | 'duration'
  | 'streak'
  | 'elevation'
  | 'route_creation';

export type TargetPreset = {
  value: number;
  label: string;
};

export type ChallengePreset = {
  id: string;
  label: string;
  description: string;
  targetValue: number;
  unit: GoalUnit;
};

export type GoalCategoryDef = {
  id: GoalCategoryId;
  label: string;
  description: string;
  goalType: GoalType;
  metric: GoalMetric;
  unit: GoalUnit;
  periods: GoalPeriod[];
  targetPresets?: TargetPreset[];
  challenges?: ChallengePreset[];
};

export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  daily: 'today',
  weekly: 'this week',
  monthly: 'this month',
  yearly: 'this year',
  lifetime: 'lifetime',
};

export const MAX_ACTIVE_GOALS = 3;

export const GOAL_CATEGORIES: GoalCategoryDef[] = [
  {
    id: 'distance',
    label: 'Distance',
    description: 'Walk a target distance over a time period.',
    goalType: 'distance',
    metric: 'distanceMetres',
    unit: 'km',
    periods: ['weekly', 'monthly', 'yearly', 'lifetime'],
    targetPresets: [
      { value: 5, label: '5 km' },
      { value: 10, label: '10 km' },
      { value: 25, label: '25 km' },
      { value: 50, label: '50 km' },
      { value: 100, label: '100 km' },
      { value: 250, label: '250 km' },
      { value: 500, label: '500 km' },
    ],
  },
  {
    id: 'walk_count',
    label: 'Walk count',
    description: 'Complete a number of walks.',
    goalType: 'walk_count',
    metric: 'walkCount',
    unit: 'walks',
    periods: ['weekly', 'monthly', 'yearly', 'lifetime'],
    targetPresets: [
      { value: 1, label: '1 walk' },
      { value: 3, label: '3 walks' },
      { value: 5, label: '5 walks' },
      { value: 10, label: '10 walks' },
      { value: 25, label: '25 walks' },
      { value: 50, label: '50 walks' },
      { value: 100, label: '100 walks' },
    ],
  },
  {
    id: 'duration',
    label: 'Duration',
    description: 'Spend time walking (moving time).',
    goalType: 'duration',
    metric: 'movingTimeSeconds',
    unit: 'seconds',
    periods: ['daily', 'weekly', 'monthly', 'yearly'],
    targetPresets: [
      { value: 30 * 60, label: '30 minutes' },
      { value: 60 * 60, label: '1 hour' },
      { value: 3 * 3600, label: '3 hours' },
      { value: 5 * 3600, label: '5 hours' },
      { value: 10 * 3600, label: '10 hours' },
      { value: 20 * 3600, label: '20 hours' },
    ],
  },
  {
    id: 'elevation',
    label: 'Elevation',
    description: 'Accumulate ascent over a period.',
    goalType: 'elevation',
    metric: 'elevationGainMetres',
    unit: 'metres',
    periods: ['weekly', 'monthly', 'yearly', 'lifetime'],
    targetPresets: [
      { value: 100, label: '100 m' },
      { value: 250, label: '250 m' },
      { value: 500, label: '500 m' },
      { value: 1000, label: '1,000 m' },
      { value: 2500, label: '2,500 m' },
      { value: 5000, label: '5,000 m' },
      { value: 10000, label: '10,000 m' },
    ],
  },
  {
    id: 'streak',
    label: 'Streak',
    description: 'Walk on consecutive days.',
    goalType: 'streak',
    metric: 'streakDays',
    unit: 'days',
    periods: ['lifetime'],
    targetPresets: [
      { value: 3, label: '3 days' },
      { value: 5, label: '5 days' },
      { value: 7, label: '7 days' },
      { value: 14, label: '14 days' },
      { value: 30, label: '30 days' },
    ],
  },
  {
    id: 'route_planning',
    label: 'Route planning',
    description: 'Create planned routes on the map.',
    goalType: 'route_creation',
    metric: 'plannedRouteCount',
    unit: 'routes',
    periods: ['monthly', 'yearly', 'lifetime'],
    targetPresets: [
      { value: 1, label: '1 route' },
      { value: 3, label: '3 routes' },
      { value: 5, label: '5 routes' },
      { value: 10, label: '10 routes' },
    ],
  },
  {
    id: 'virtual_journey',
    label: 'Virtual journey',
    description: 'Progress along a famous long-distance route.',
    goalType: 'distance',
    metric: 'distanceMetres',
    unit: 'km',
    periods: ['lifetime'],
    challenges: [
      {
        id: 'lejog',
        label: 'Lands End → John O\'Groats',
        description: 'The length of Great Britain, north to south.',
        targetValue: 1407,
        unit: 'km',
      },
      {
        id: 'swcp',
        label: 'South West Coast Path',
        description: 'England\'s longest National Trail.',
        targetValue: 1014,
        unit: 'km',
      },
      {
        id: 'hadrians_wall',
        label: 'Hadrian\'s Wall Path',
        description: 'Coast to coast along the Roman wall.',
        targetValue: 135,
        unit: 'km',
      },
      {
        id: 'c2c',
        label: 'Coast to Coast',
        description: 'Wainwright\'s classic across northern England.',
        targetValue: 309,
        unit: 'km',
      },
    ],
  },
  {
    id: 'climb_challenge',
    label: 'Famous climb',
    description: 'Accumulate ascent equal to an iconic summit.',
    goalType: 'elevation',
    metric: 'elevationGainMetres',
    unit: 'metres',
    periods: ['lifetime'],
    challenges: [
      {
        id: 'eiffel',
        label: 'Eiffel Tower',
        description: '330 m of ascent.',
        targetValue: 330,
        unit: 'metres',
      },
      {
        id: 'snowdon',
        label: 'Snowdon',
        description: '1,085 m — Wales\' highest peak.',
        targetValue: 1085,
        unit: 'metres',
      },
      {
        id: 'ben_nevis',
        label: 'Ben Nevis',
        description: '1,345 m — Scotland\'s highest peak.',
        targetValue: 1345,
        unit: 'metres',
      },
      {
        id: 'kilimanjaro',
        label: 'Kilimanjaro',
        description: '5,895 m — Africa\'s highest peak.',
        targetValue: 5895,
        unit: 'metres',
      },
      {
        id: 'everest',
        label: 'Mount Everest',
        description: '8,849 m — the world\'s highest summit.',
        targetValue: 8849,
        unit: 'metres',
      },
    ],
  },
];

export function getGoalCategory(id: GoalCategoryId): GoalCategoryDef | undefined {
  return GOAL_CATEGORIES.find((c) => c.id === id);
}

export function getPeriodLabel(period: GoalPeriod): string {
  return GOAL_PERIOD_LABELS[period];
}
