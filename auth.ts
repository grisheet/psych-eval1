import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';
import nodemailer from 'nodemailer';
import { db } from '../db';
import * as schema from '../db/schema';
export const auth = betterAuth({
  appName: 'Clearframe',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 14,
    revokeSessionsOnPasswordReset: true,
    ...(process.env.SMTP_HOST
      ? {
          sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
            await nodemailer
              .createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT || 587),
                secure: process.env.SMTP_PORT === '465',
                requireTLS: true,
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
              })
              .sendMail({
                from: process.env.SMTP_FROM,
                to: user.email,
                subject: 'Reset your Clearframe password',
                text: `Reset your password using this link: ${url}\nIf you did not request this, ignore this message.`,
              });
          },
        }
      : {}),
  },
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'participant', input: false },
      disabled: { type: 'boolean', defaultValue: false, input: false },
    },
  },
  session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 15, cookieCache: { enabled: false } },
  rateLimit: { enabled: true, window: 60, max: 30, storage: 'database' },
  advanced: { useSecureCookies: process.env.BETTER_AUTH_URL?.startsWith('https://') ?? false },
  plugins: [twoFactor({ issuer: 'Clearframe' })],
});
