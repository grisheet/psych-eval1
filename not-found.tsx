import { PublicPage } from '@/components/public-page';
export default function Page() {
  return (
    <PublicPage eyebrow="PAGE NOT FOUND" title="Let’s get you back on track.">
      <p>
        This page is unavailable. <a href="/workspace">Return to your workspace</a> or{' '}
        <a href="/urgent-help">get urgent help</a>.
      </p>
    </PublicPage>
  );
}
