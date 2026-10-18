import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function signIn(page: Page, email: string) {
  await page.goto('/signin');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Clearframe-demo-2026!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page).toHaveURL('/workspace');
}
test('participant-to-reviewer journey, report finalization, and note exclusion', async ({
  page,
}) => {
  await signIn(page, 'alex@demo.invalid');
  await page.goto('/workspace/consent');
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('checkbox').nth(1).check();
  await page.getByRole('button', { name: 'Agree & continue' }).click();
  await page.getByLabel('Preferred name', { exact: true }).fill('Alex (synthetic)');
  await page.getByRole('button', { name: 'Save & explore assessments' }).click();
  await page
    .locator('.module-card')
    .filter({ has: page.getByRole('heading', { name: 'Your context & goals' }) })
    .getByRole('button', { name: /Start module|Resume draft/ })
    .click();
  await page
    .getByRole('textbox', { name: 'What would you like to discuss?' })
    .fill('Synthetic concern: organizing a new study routine.');
  await page.getByRole('button', { name: 'Save now' }).click();
  await expect(page.getByText('Saved on server', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save & pause' }).click();
  await expect(page).toHaveURL('/workspace');
  await page.getByRole('link', { name: 'Resume assessment' }).click();
  await expect(page.getByRole('textbox', { name: 'What would you like to discuss?' })).toHaveValue(
    'Synthetic concern: organizing a new study routine.',
  );
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'What would you like to discuss?' })).toHaveValue(
    'Synthetic concern: organizing a new study routine.',
  );
  await page.getByRole('button', { name: 'Review & submit', exact: false }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Submit responses', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Response completeness' })).toBeVisible();
  await expect(page.getByText('No clinical score calculated.', { exact: false })).toBeVisible();
  const assessmentId = page.url().split('/').pop();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await signIn(page, 'reviewer@demo.invalid');
  await page.getByRole('link', { name: 'Open record', exact: true }).click();
  await page.getByLabel('Note', { exact: true }).fill('E2E-INTERNAL-NOTE-EXCLUDED');
  await page.getByRole('button', { name: 'Add internal note' }).click();
  await expect(page.getByText('E2E-INTERNAL-NOTE-EXCLUDED', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create draft report' }).click();
  await page
    .getByLabel('Interpretation limitations (required to finalize)')
    .fill('Synthetic demo only. No verified clinical measure was administered.');
  await page
    .getByLabel('Follow-up plan (required to finalize)')
    .fill('Review this synthetic example in the demonstration.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Finalize reviewed demo report' }).click();
  await expect(page.getByText('Demo report finalized. This version is immutable.')).toBeVisible();
  await expect(page.locator('.report')).not.toContainText('E2E-INTERNAL-NOTE-EXCLUDED');
  await page.getByLabel('Reason for amendment').fill('Correct the synthetic follow-up wording.');
  await page.getByRole('button', { name: 'Create amendment draft' }).click();
  await expect(page.getByRole('heading', { name: 'Assessment review · v2' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await signIn(page, 'alex@demo.invalid');
  const exported = await page.request.get('/api/workspace/export');
  expect(exported.status()).toBe(200);
  expect(await exported.text()).not.toContain('E2E-INTERNAL-NOTE-EXCLUDED');
  const other = await page.request.get('/api/workspace/assessment/demo-private-assessment');
  expect(other.status()).toBe(403);
  await page.goto(`/workspace/assessment/${assessmentId}`);
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
test('public safety page and keyboard access are available without sign-in', async ({ page }) => {
  await page.goto('/urgent-help');
  await expect(
    page.getByText('This application is not monitored.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText('contact your local emergency services', { exact: false }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.goto('/signin');
  await page.getByLabel('Email address').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
});
