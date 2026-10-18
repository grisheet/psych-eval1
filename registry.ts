import type { InstrumentDefinition, Item } from './types';
const text = (id: string, label: string, sensitive = false): Item => ({
  id,
  label,
  type: 'long',
  sensitive,
});
const base = {
  version: '1.0.0',
  language: 'en',
  population: 'Adults (18+) — synthetic demonstration only',
  source: 'Original Clearframe demonstration content; not an established instrument.',
  license: 'Original demo items licensed under MIT with this repository.',
  administration: 'Optional self-report, no supervision assumed.',
  missingRule: 'Preserve missing states. Never impute zero. No clinical score is calculated.',
  algorithmVersion: 'completeness-1.0.0',
  interpretationSource: 'None. No clinical interpretations or cutoffs.',
  limitations:
    'Not validated. Not for clinical use. Does not assess diagnosis or immediate safety.',
  reviewStatus: 'Unreviewed demonstration',
  reviewer: null,
  reviewDate: null,
};
export const intake: InstrumentDefinition = {
  ...base,
  id: 'intake',
  name: 'Your context & goals',
  domain: 'Core intake',
  purpose: 'Organize participant-stated concerns, context, history, and strengths.',
  recallPeriod: 'Current context and history as you choose to describe it.',
  sections: [
    {
      title: 'What brings you here',
      introduction:
        'Share only what you want a reviewer to understand. Skipping is always available.',
      items: [
        text('concerns', 'What would you like to discuss?'),
        text('goals', 'What would you like to understand or improve?'),
        {
          id: 'onset',
          label: 'When did you first notice these concerns? (optional)',
          type: 'date',
        },
        text('duration', 'How long have these concerns been present?'),
        {
          id: 'impact',
          label: 'How much does this affect everyday life?',
          type: 'single',
          options: ['A little', 'Somewhat', 'A lot', 'It varies'],
        },
        text('situations', 'When or where do you notice these concerns?'),
      ],
    },
    {
      title: 'Everyday context',
      introduction: 'These details provide context, not a diagnosis.',
      items: [
        text('work', 'Work or education'),
        text('living', 'Living situation and relationships'),
        text('stressors', 'Current stressors'),
        text('housing', 'Housing or financial concerns (optional)', true),
        text('culture', 'Cultural or identity factors you want considered (optional)', true),
      ],
    },
    {
      title: 'Relevant history',
      introduction: 'All history here is self-reported. You do not need to disclose trauma.',
      items: [
        {
          id: 'priorCare',
          label: 'Have you received mental health care?',
          type: 'single',
          options: ['Yes', 'No'],
        },
        {
          ...text('careDetails', 'Anything about prior care you want to share?', true),
          when: { item: 'priorCare', equals: 'Yes' },
        },
        text('diagnoses', 'Prior diagnoses, if any (self-reported)', true),
        text('medical', 'Relevant medical conditions (optional)', true),
        text('medications', 'Medications (optional)', true),
        text('substances', 'Substance use you want to discuss (optional)', true),
        text('sleep', 'Sleep patterns'),
        text('events', 'Major life events you want considered (optional)', true),
        text('hospitalizations', 'Past hospital care you want to mention (optional)', true),
        text('family', 'Family history you want to share (optional)', true),
      ],
    },
    {
      title: 'Strengths & support',
      introduction: 'Your resources and priorities are part of the picture.',
      items: [
        text('support', 'Supportive people or communities'),
        text('coping', 'What helps you cope?'),
        text('interests', 'Interests, activities, and personal strengths'),
        text('seeking', 'What led you to seek support now?'),
      ],
    },
  ],
};
const domains = [
  ['mood', 'Mood & daily rhythm', 'Mood and depressive symptoms'],
  ['anxiety', 'Worry & uncertainty', 'Anxiety'],
  ['stress', 'Stress & demands', 'Stress'],
  ['sleep', 'Sleep & rest', 'Sleep'],
  ['attention', 'Focus & organization', 'Attention and executive function'],
  ['trauma', 'Difficult experiences', 'Trauma-related concerns'],
  ['ocd', 'Repetitive thoughts & actions', 'Obsessive-compulsive concerns'],
  ['substances', 'Substances & everyday life', 'Substance-use concerns'],
  ['eating', 'Food & body concerns', 'Eating-related concerns'],
  ['perception', 'Unusual experiences', 'Perceptual or thought experiences'],
  ['activation', 'Energy & activation', 'Elevated mood or activation'],
  ['functioning', 'Daily activities', 'Social and occupational functioning'],
  ['wellbeing', 'Well-being', 'Quality of life'],
  ['relationships', 'Connection & support', 'Relationships and support'],
  ['strengths', 'Strengths & coping', 'Strengths'],
  ['goals', 'Your next steps', 'Participant-defined goals'],
];
export const modules: InstrumentDefinition[] = domains.map(([id, name, domain]) => ({
  ...base,
  id,
  name,
  domain,
  purpose: `A nonclinical conversation guide about ${domain.toLowerCase()}.`,
  recallPeriod: 'The past week, if relevant to you.',
  sections: [
    {
      title: 'Your perspective',
      introduction:
        'Original demonstration prompts. These are not a validated screening measure. You may skip any question.',
      items: [
        text('description', `What would you like to share about ${domain.toLowerCase()}?`, true),
        {
          id: 'frequency',
          label: 'On how many days in the past week was this on your mind?',
          type: 'number',
          min: 0,
          max: 7,
        },
        {
          id: 'experience',
          label: 'How would you describe its effect on everyday life?',
          type: 'likert',
          options: [
            'No effect',
            'A small effect',
            'A noticeable effect',
            'A substantial effect',
            'It varies',
          ],
        },
        {
          id: 'areas',
          label: 'Which areas would you like to discuss? Select any.',
          type: 'multiple',
          options: ['Home', 'Work or study', 'Relationships', 'Daily routines', 'Something else'],
        },
        text('helpful', 'What has helped or what would you like support with?'),
        { id: 'topic', label: 'A short topic to bring to your reviewer (optional)', type: 'short' },
      ],
    },
  ],
}));
export const registry = [intake, ...modules];
export const versionId = (d: InstrumentDefinition) => `${d.id}@${d.version}`;
