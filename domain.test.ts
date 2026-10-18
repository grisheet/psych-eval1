import { describe, it, expect } from 'vitest';
import { registry, intake, modules } from '../src/domain/registry';
import { summarize, validateAnswers, visibleItems } from '../src/domain/assessment';
import { canReadClinical, checkRevision } from '../src/domain/authorization';
import { validateRuntime } from '../src/domain/config';
import type { Actor } from '../src/domain/types';
const participant: Actor = { id: 'a', name: 'A', role: 'participant' };
describe('Nonclinical scoring boundaries', () => {
  it('does not produce a score when all responses are missing', () => {
    const r = summarize(modules[0], {});
    expect(r.score).toBeNull();
    expect(r.answered).toBe(0);
    expect(r.missing).toHaveLength(6);
    expect(r.explanation).toContain('No validated');
  });
  it.each([0, 7])('accepts numeric boundary %s without a clinical threshold', (value) => {
    expect(summarize(modules[0], { frequency: { state: 'answered', value } })).toMatchObject({
      answered: 1,
      score: null,
      instrumentVersion: '1.0.0',
      algorithmVersion: 'completeness-1.0.0',
    });
  });
  it.each([-1, 8, 1.1, NaN, Infinity])('rejects impossible value %s', (value) =>
    expect(() => summarize(modules[0], { frequency: { state: 'answered', value } })).toThrow(),
  );
  it.each(['unanswered', 'prefer-not', 'not-applicable', 'unknown'])(
    'preserves %s without zero imputation',
    (state) => {
      const r = summarize(modules[0], { frequency: { state } });
      expect(r.answered).toBe(0);
      expect(r.missing.find((i) => i.itemId === 'frequency')?.state).toBe(state);
    },
  );
  it('rejects a number disguised as a string', () =>
    expect(() =>
      validateAnswers(modules[0], { frequency: { state: 'answered', value: '7' } }),
    ).toThrow());
  it('rejects unknown, clinician-only and calculated input fields', () => {
    for (const input of [
      { invented: { state: 'answered', value: 1 } },
      { private: { state: 'answered', value: 'x' } },
      { derived: { state: 'answered', value: 1 } },
    ])
      expect(() =>
        validateAnswers(
          {
            ...modules[0],
            sections: [
              {
                title: 't',
                introduction: 'i',
                items: [
                  { id: 'private', label: 'Private', type: 'short', clinicianOnly: true },
                  { id: 'derived', label: 'Calculated', type: 'calculated' },
                ],
              },
            ],
          },
          input,
        ),
      ).toThrow();
  });
  it('rejects unrecognized choices and duplicate multiselect values', () => {
    expect(() =>
      validateAnswers(modules[0], { experience: { state: 'answered', value: 'Severe diagnosis' } }),
    ).toThrow();
    expect(() =>
      validateAnswers(modules[0], { areas: { state: 'answered', value: ['Home', 'Home'] } }),
    ).toThrow();
  });
  it('counts a full synthetic example without clinical interpretation', () => {
    const r = summarize(modules[0], {
      description: { state: 'answered', value: 'Synthetic' },
      frequency: { state: 'answered', value: 4 },
      experience: { state: 'answered', value: 'It varies' },
      areas: { state: 'answered', value: ['Home'] },
      helpful: { state: 'answered', value: 'A walk' },
      topic: { state: 'answered', value: 'Routine' },
    });
    expect(r).toMatchObject({ answered: 6, total: 6, missing: [], score: null });
  });
  it('uses conditional visibility and discards stale hidden answers', () => {
    const raw = {
      priorCare: { state: 'answered', value: 'No' },
      careDetails: { state: 'answered', value: 'Old hidden detail' },
    };
    expect(validateAnswers(intake, raw)).not.toHaveProperty('careDetails');
    expect(
      visibleItems(intake, { priorCare: { state: 'answered', value: 'Yes' } }).some(
        (i) => i.id === 'careDetails',
      ),
    ).toBe(true);
  });
  it('rejects nonexistent and future calendar dates', () => {
    for (const value of ['2025-02-30', '2999-01-01', 'not-a-date'])
      expect(() => validateAnswers(intake, { onset: { state: 'answered', value } })).toThrow();
  });
  it('handles empty strings and arrays as missing', () => {
    expect(
      summarize(modules[0], {
        description: { state: 'answered', value: '  ' },
        areas: { state: 'answered', value: [] },
      }).answered,
    ).toBe(0);
  });
  it('rejects unsupported algorithm versions', () =>
    expect(() => summarize({ ...modules[0], algorithmVersion: '2' }, {})).toThrow());
  it('labels every module as unreviewed and nonclinical', () => {
    expect(registry).toHaveLength(17);
    for (const d of registry) {
      expect(d.reviewStatus).toContain('demonstration');
      expect(d.limitations).toContain('Not for clinical use');
      expect(d.reviewer).toBeNull();
      expect(d.interpretationSource).toContain('No clinical');
    }
  });
});
describe('Authorization and deployment boundaries', () => {
  it('allows participant ownership only', () => {
    expect(canReadClinical(participant, 'a', false)).toBe(true);
    expect(canReadClinical(participant, 'b', true)).toBe(false);
  });
  it('requires an explicit clinician assignment', () => {
    expect(canReadClinical({ ...participant, role: 'clinician' }, 'b', false)).toBe(false);
    expect(canReadClinical({ ...participant, role: 'clinician' }, 'b', true)).toBe(true);
  });
  it('does not give operational admins clinical access', () =>
    expect(canReadClinical({ ...participant, role: 'admin' }, 'b', true)).toBe(false));
  it('rejects stale revisions', () => expect(() => checkRevision(2, 1)).toThrow('another window'));
  it('rejects insecure production startup', () => {
    expect(() =>
      validateRuntime({
        NODE_ENV: 'production',
        DEMO_MODE: 'true',
        BETTER_AUTH_SECRET: 'a'.repeat(40),
      }),
    ).toThrow('demo');
    expect(() =>
      validateRuntime({
        NODE_ENV: 'production',
        DEMO_MODE: 'false',
        BETTER_AUTH_SECRET: 'a'.repeat(40),
      }),
    ).toThrow('PostgreSQL');
  });
});
