import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';

/**
 * Delivery of verification codes by email (Brevo HTTPS API, or SMTP) and SMS (Africa's Talking).
 *
 * Nothing here ever pretends a message was sent: when a channel is not configured, `*Enabled()` is false
 * and callers must refuse the flow that depends on it. Outside production a code is printed to the server
 * log instead, so development works without any provider. Under NODE_ENV=test messages are captured in
 * `testOutbox` so tests can read the codes.
 */

export const testOutbox: { channel: 'email' | 'sms'; to: string; text: string }[] = [];

const brevoEnabled = (): boolean => !!(config.notify.brevo.apiKey && config.notify.brevo.from);
const smtpEnabled = (): boolean => !!(config.notify.smtp.host && config.notify.smtp.user && config.notify.smtp.pass);
export const emailEnabled = (): boolean => brevoEnabled() || smtpEnabled();
/** Which provider will carry the next email. Brevo (HTTPS) wins: Render's free plan blocks SMTP ports. */
export const emailProvider = (): 'brevo' | 'smtp' | null => (brevoEnabled() ? 'brevo' : smtpEnabled() ? 'smtp' : null);
export const smsEnabled = (): boolean => !!(config.notify.sms.username && config.notify.sms.apiKey);

const isTest = () => process.env.NODE_ENV === 'test';

/** Whether an email can be delivered here (a real provider, or a dev/test fallback outside production). */
export const emailAvailable = (): boolean => emailEnabled() || !config.isProduction;
export const smsAvailable = (): boolean => smsEnabled() || (isTest() && process.env.TEST_SMS === '1');

let transport: Transporter | null = null;
/** Forget the cached connection settings (used by tests and the email check script). */
export function resetTransport() {
  transport = null;
}
function getTransport() {
  if (!transport) {
    const { host, port, user, pass, secure } = config.notify.smtp;
    transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000 });
  }
  return transport;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (isTest()) {
    testOutbox.push({ channel: 'email', to, text });
    return;
  }
  if (!emailEnabled()) {
    if (config.isProduction) throw new Error('Email delivery is not configured');
    console.log(`[dev email to ${to}] ${subject}: ${text}`);
    return;
  }
  if (brevoEnabled()) {
    const { apiKey, from, fromName, baseUrl } = config.notify.brevo;
    const res = await fetch(`${baseUrl}/v3/smtp/email`, {
      method: 'POST',
      headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ sender: { email: from, name: fromName }, to: [{ email: to }], subject, textContent: text }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      // Brevo explains what is wrong (unverified sender, bad key, ...). The API key is never logged.
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`Brevo rejected the email (${res.status}): ${detail}`);
    }
    return;
  }
  await getTransport().sendMail({ from: config.notify.smtp.from, to, subject, text });
}

export async function sendSms(phone: string, text: string): Promise<void> {
  if (isTest()) {
    testOutbox.push({ channel: 'sms', to: phone, text });
    return;
  }
  if (!smsEnabled()) throw new Error('SMS delivery is not configured');
  const { username, apiKey, senderId, baseUrl } = config.notify.sms;
  const body = new URLSearchParams({ username, to: `+${phone}`, message: text });
  if (senderId) body.set('from', senderId);
  const res = await fetch(`${baseUrl}/version1/messaging`, {
    method: 'POST',
    headers: { apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`SMS provider rejected the message (${res.status})`);
}
