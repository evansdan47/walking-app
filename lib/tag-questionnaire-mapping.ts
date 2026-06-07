export type QuestionnaireAnswers = {
  landscape?: string;
  difficulty?: string;
  views?: string;
  facilities?: string[];
  dogFriendly?: boolean;
  peaceful?: boolean;
};

const LANDSCAPE_SLUGS: Record<string, string> = {
  coastal: 'landscape.coastal',
  woodland: 'landscape.woodland',
  countryside: 'landscape.countryside',
  mountain: 'landscape.mountain',
  urban: 'landscape.urban',
  mixed: 'landscape.valley',
};

const DIFFICULTY_SLUGS: Record<string, string> = {
  very_easy: 'difficulty.easy',
  easy: 'difficulty.easy',
  moderate: 'difficulty.moderate',
  hard: 'difficulty.hard',
  challenging: 'difficulty.challenging',
};

const VIEWS_SLUGS: Record<string, string> = {
  poor: '',
  average: '',
  good: 'features.great_views',
  excellent: 'features.great_views',
};

const FACILITY_SLUGS: Record<string, string> = {
  parking: 'facilities.parking',
  toilets: 'facilities.toilets',
  cafe: 'facilities.cafe',
  pub: 'facilities.pub',
  visitor_centre: 'facilities.visitor_centre',
};

export function mapQuestionnaireToSlugs(answers: QuestionnaireAnswers): string[] {
  const slugs = new Set<string>();
  if (answers.landscape) {
    const slug = LANDSCAPE_SLUGS[answers.landscape];
    if (slug) slugs.add(slug);
  }
  if (answers.difficulty) {
    const slug = DIFFICULTY_SLUGS[answers.difficulty];
    if (slug) slugs.add(slug);
  }
  if (answers.views) {
    const slug = VIEWS_SLUGS[answers.views];
    if (slug) slugs.add(slug);
  }
  for (const facility of answers.facilities ?? []) {
    const slug = FACILITY_SLUGS[facility];
    if (slug) slugs.add(slug);
  }
  if (answers.dogFriendly) slugs.add('dog.dog_friendly');
  if (answers.peaceful) slugs.add('features.peaceful');
  return [...slugs];
}

export function slugsToTagIds(
  slugs: string[],
  tags: { _id: string; slug: string }[],
): string[] {
  const bySlug = new Map(tags.map((tag) => [tag.slug, tag._id]));
  return slugs.map((slug) => bySlug.get(slug)).filter((id): id is string => !!id);
}
