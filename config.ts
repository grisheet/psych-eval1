export function validateRuntime(env: NodeJS.ProcessEnv) {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)
    throw new Error('Set a randomly generated BETTER_AUTH_SECRET (32+ characters).');
  if (env.NODE_ENV === 'production') {
    if (env.DEMO_MODE !== 'false') throw new Error('Production refuses demo mode.');
    if (!env.DATABASE_URL?.startsWith('postgres'))
      throw new Error('Production requires PostgreSQL.');
    if (!env.BETTER_AUTH_URL?.startsWith('https://'))
      throw new Error('Production requires an HTTPS origin.');
    if (env.DEPLOYMENT_REVIEW_ACK !== 'true')
      throw new Error('Complete the deployment review before starting production.');
    if (/demo|example|change-me/i.test(env.BETTER_AUTH_SECRET))
      throw new Error('Production refuses example secrets.');
  }
}
export function consentText(retentionDays: number, confidentiality: string) {
  return `Clearframe organizes self-reported assessment information for professional review. This is a synthetic demonstration, not a psychologist, diagnostic system, validated screening service, or emergency service. Participation is self-guided and restricted to adults. Only you and explicitly assigned reviewers can access your assessment records; administrators manage operations. Your profile, consent, responses, and report history are stored on the server. The configured retention target is ${retentionDays} days; deletion is a manual, reviewed process and backups require separate handling. You may withdraw consent in Account settings, stopping new collection and reviewer access. Withdrawal does not automatically delete existing records; you may request deletion separately. No submissions are monitored in this demo, and no review time is promised. AI processing, research collection, and analytics are disabled. ${confidentiality} Screening is not diagnosis. Use synthetic information only.`;
}
