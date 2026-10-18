'use client';
import { Button } from '@/components/ui';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>Something didn’t load.</h1>
      <p>
        No assessment details are included in this error. Try again, or return to sign-in if your
        session expired.
      </p>
      <Button onClick={reset}>Try again</Button>
      <p style={{ marginTop: 20 }}>
        <a href="/signin">Sign in</a> · <a href="/urgent-help">Get urgent help</a>
      </p>
    </main>
  );
}
