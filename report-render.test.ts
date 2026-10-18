import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { ReportPreview } from '../src/components/report';
import { MSE_FIELDS, REPORT_FIELDS, type ReportSnapshot } from '../src/domain/types';
const snapshot: ReportSnapshot = {
  participantId: 'synthetic-id',
  participantName: '<script>untrusted()</script>',
  demo: true,
  createdAt: new Date().toISOString(),
  consent: [],
  measures: [],
  narrative: Object.fromEntries(REPORT_FIELDS.map((f) => [f, ''])),
  observations: Object.fromEntries(
    MSE_FIELDS.map((f) => [f, { status: 'not-assessed' as const, text: '' }]),
  ),
  reviewerName: 'Demo reviewer',
  credentials: null,
  credentialsVerified: false,
  reviewed: false,
};
const record = {
  id: 'r1',
  reportId: 'report',
  number: 1,
  status: 'draft' as const,
  revision: 0,
  snapshot,
  signedBy: null,
  signedAt: null,
  amendmentReason: null,
  parentVersionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  participantId: 'synthetic-id',
};
describe('Accessible HTML report rendering', () => {
  it('marks drafts and demonstration content prominently', () => {
    const html = renderToStaticMarkup(createElement(ReportPreview, { record, snapshot }));
    expect(html).toContain('DRAFT · NOT FINALIZED');
    expect(html).toContain('NOT FOR CLINICAL USE');
    expect(html).toContain('Not assessed');
    expect(html).toContain('Professional credentials are not verified');
  });
  it('escapes untrusted participant text and does not invent observations', () => {
    const html = renderToStaticMarkup(createElement(ReportPreview, { record, snapshot }));
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>untrusted()');
    expect(html).not.toContain('Normal judgment');
  });
});
