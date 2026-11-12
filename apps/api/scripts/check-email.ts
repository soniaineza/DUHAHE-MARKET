/**
 * Sends one real test email using the SMTP_* settings, so you can confirm your email setup works
 * BEFORE deploying.
 *
 *   SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_USER=you@gmail.com SMTP_PASS="your app password" \
 *     npm run check-email -w @duhahe/api -- someone@example.com
 *
 * (On PowerShell set the variables first:  $env:SMTP_USER="you@gmail.com"  etc.)
 */
import { config } from '../src/config';
import { emailEnabled, sendEmail } from '../src/services/notify';

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes('@')) {
    console.error('Usage: npm run check-email -w @duhahe/api -- recipient@example.com');
    process.exit(2);
  }
  if (!emailEnabled()) {
    console.error('Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS first.');
    process.exit(2);
  }
  console.log(`Sending a test email to ${to} through ${config.notify.smtp.host}:${config.notify.smtp.port} as ${config.notify.smtp.user} ...`);
  try {
    await sendEmail(to, 'Duhahe Rwanda Market email check', 'If you can read this, verification codes will reach your customers.');
    console.log('Sent. Check the inbox (and the spam folder).');
  } catch (err) {
    console.error('FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

void main();
