export type Role = 'participant' | 'clinician' | 'admin';
export type Actor = { id: string; name: string; role: Role };
export type Answer =
  | { state: 'answered'; value: string | number | string[] }
  | { state: 'unanswered' | 'prefer-not' | 'not-applicable' | 'unknown'; value?: never };
export type Answers = Record<string, Answer>;
export type Item = {
  id: string;
  label: string;
  type: 'single' | 'multiple' | 'likert' | 'number' | 'short' | 'long' | 'date' | 'calculated';
  options?: string[];
  required?: boolean;
  sensitive?: boolean;
  min?: number;
  max?: number;
  help?: string;
  clinicianOnly?: boolean;
  when?: { item: string; equals: string };
};
export type InstrumentDefinition = {
  id: string;
  name: string;
  version: string;
  language: string;
  population: string;
  purpose: string;
  recallPeriod: string;
  source: string;
  license: string;
  administration: string;
  missingRule: string;
  algorithmVersion: string;
  interpretationSource: string;
  limitations: string;
  reviewStatus: string;
  reviewer: string | null;
  reviewDate: string | null;
  domain: string;
  sections: { title: string; introduction: string; items: Item[] }[];
};
export type DerivedResult = {
  kind: 'nonclinical-summary';
  algorithmVersion: string;
  instrumentVersion: string;
  answered: number;
  total: number;
  missing: { itemId: string; state: string }[];
  score: null;
  explanation: string;
};
export const MSE_FIELDS = [
  'Appearance and behavior',
  'Engagement',
  'Speech',
  'Reported mood',
  'Observed affect',
  'Thought process',
  'Thought content',
  'Perceptual experiences',
  'Orientation',
  'Attention',
  'Memory',
  'Insight',
  'Judgment',
  'Additional observations',
] as const;
export const REPORT_FIELDS = [
  'Referral question',
  'Sources of information',
  'Presenting concerns',
  'Relevant history',
  'Functional impact',
  'Strengths and supports',
  'Clinician formulation',
  'Diagnostic considerations',
  'Recommendations',
  'Follow-up plan',
  'Interpretation limitations',
] as const;
export type ReportSnapshot = {
  participantId: string;
  participantName: string;
  demo: true;
  createdAt: string;
  consent: { version: string; createdAt: string; scope: string }[];
  measures: {
    name: string;
    version: string;
    submittedAt: string | null;
    result: DerivedResult | null;
    answers: Answers;
  }[];
  narrative: Record<string, string>;
  observations: Record<
    string,
    { status: 'not-assessed' | 'unable-to-assess' | 'observed'; text: string }
  >;
  reviewerName: string;
  credentials: string | null;
  credentialsVerified: boolean;
  reviewed: boolean;
};
