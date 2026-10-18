import { z } from 'zod';
import type { Answer, Answers, InstrumentDefinition, Item, DerivedResult } from './types';
export const answerSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('answered'),
      value: z.union([
        z.string().max(4000),
        z.number().finite(),
        z.array(z.string().max(200)).max(30),
      ]),
    })
    .strict(),
  ...(['unanswered', 'prefer-not', 'not-applicable', 'unknown'] as const).map((state) =>
    z.object({ state: z.literal(state) }).strict(),
  ),
]);
export const answersSchema = z.record(z.string().max(80), answerSchema);
export function isVisible(item: Item, answers: Answers) {
  return (
    !item.when ||
    (answers[item.when.item]?.state === 'answered' &&
      answers[item.when.item]?.value === item.when.equals)
  );
}
export function visibleItems(def: InstrumentDefinition, answers: Answers) {
  return def.sections
    .flatMap((s) => s.items)
    .filter((i) => !i.clinicianOnly && i.type !== 'calculated' && isVisible(i, answers));
}
export function validateAnswers(
  def: InstrumentDefinition,
  input: unknown,
  submitting = false,
): Answers {
  const answers = answersSchema.parse(input) as Answers;
  const items = def.sections.flatMap((s) => s.items);
  for (const [key, answer] of Object.entries(answers)) {
    const item = items.find((i) => i.id === key);
    if (!item || item.clinicianOnly || item.type === 'calculated')
      throw new Error('Unknown or protected response field.');
    if (!isVisible(item, answers)) {
      delete answers[key];
      continue;
    }
    if (answer.state !== 'answered') continue;
    const value = answer.value;
    if (item.type === 'number') {
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < (item.min ?? -Infinity) ||
        value > (item.max ?? Infinity)
      )
        throw new Error(`Invalid numeric response: ${item.label}`);
    } else if (item.type === 'multiple') {
      if (
        !Array.isArray(value) ||
        new Set(value).size !== value.length ||
        value.some((v) => !item.options?.includes(v))
      )
        throw new Error('Invalid multiple-choice response.');
    } else {
      if (typeof value !== 'string') throw new Error('Expected a text response.');
      if (['single', 'likert'].includes(item.type) && !item.options?.includes(value))
        throw new Error('Invalid response option.');
      if (
        item.type === 'date' &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(Date.parse(value)) ||
          new Date(value).toISOString().slice(0, 10) !== value ||
          value > new Date().toISOString().slice(0, 10))
      )
        throw new Error('Enter a valid date that is not in the future.');
      if (item.type === 'short' && value.length > 200)
        throw new Error('Short responses must be 200 characters or fewer.');
    }
  }
  if (submitting)
    for (const item of visibleItems(def, answers)) {
      if (item.required && (!answers[item.id] || answers[item.id].state === 'unanswered'))
        throw new Error(`Respond or choose a skip option: ${item.label}`);
    }
  return answers;
}
export function summarize(def: InstrumentDefinition, input: unknown): DerivedResult {
  if (def.algorithmVersion !== 'completeness-1.0.0')
    throw new Error('Unsupported algorithm version.');
  const answers = validateAnswers(def, input, true),
    items = visibleItems(def, answers);
  const complete = (a: Answer | undefined) =>
    a?.state === 'answered' &&
    (Array.isArray(a.value)
      ? a.value.length > 0
      : typeof a.value === 'string'
        ? a.value.trim().length > 0
        : true);
  return {
    kind: 'nonclinical-summary',
    algorithmVersion: def.algorithmVersion,
    instrumentVersion: def.version,
    answered: items.filter((i) => complete(answers[i.id])).length,
    total: items.length,
    missing: items
      .filter((i) => !complete(answers[i.id]))
      .map((i) => ({
        itemId: i.id,
        state:
          answers[i.id]?.state === 'answered'
            ? 'unanswered'
            : (answers[i.id]?.state ?? 'unanswered'),
      })),
    score: null,
    explanation:
      'Structured self-report only. No validated screening instrument is configured, so no clinical score or severity category is calculated.',
  };
}
