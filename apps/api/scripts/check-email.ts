/**
 * Sends one real test email using your email settings (BREVO_API_KEY + EMAIL_FROM, or SMTP_*), so you can
 * confirm the setup works BEFORE deploying.
 *
 *   cmd:         set BREVO_API_KEY=xkeysib-...   then   set EMAIL_FROM=you@gmail.com
 *   PowerShell:  $env:BREVO_API_KEY="xkeysib-..." ; $env:EMAIL_FROM="you@gmail.com"
 *   then:        npm run check-email -w @duhahe/api -- someone@example.com
 */
import { config } from '../src/config';
import { emailEnabled, emailProvider, sendEmail } from '../src/services/notify';

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes('@')) {
    console.error('Usage: npm run check-email -w @duhahe/api -- recipient@example.com');
    process.exit(2);
  }
  if (!emailEnabled()) {
    console.error('Email is not configured. Set BREVO_API_KEY and EMAIL_FROM (recommended), or SMTP_HOST, SMTP_USER and SMTP_PASS.');
    process.exit(2);
  }
  const via = emailProvider() === 'brevo' ? `Brevo API as ${config.notify.brevo.from}` : `${config.notify.smtp.host}:${config.notify.smtp.port} as ${config.notify.smtp.user}`;
  console.log(`Sending a test email to ${to} via ${via} ...`);
  try {
    await sendEmail(to, 'Duhahe Rwanda Market email check', 'If you can read this, verification codes will reach your customers.');
    console.log('Sent. Check the inbox (and the spam folder).');
  } catch (err) {
    console.error('FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

void main();
