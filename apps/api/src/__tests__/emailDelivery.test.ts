/**
 * End-to-end email delivery: the sign-up route sends a REAL SMTP message (through nodemailer) to a small
 * in-process mail server, and the code in that message completes the sign-up. This proves the codes are
 * actually delivered to the address that was typed, not just generated.
 */
process.env.DEMO_MODE = 'true';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import type { AddressInfo } from 'node:net';

interface Mail {
  from: string;
  to: string[];
  data: string;
}

/** A minimal SMTP server: AUTH PLAIN/LOGIN accepted, messages captured. */
function startFakeSmtp(): Promise<{ server: net.Server; port: number; mails: Mail[] }> {
  const mails: Mail[] = [];
  const server = net.createServer((socket) => {
    let mail: Mail = { from: '', to: [], data: '' };
    let inData = false;
    let buf = '';
    socket.write('220 fake-smtp ready\r\n');
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      for (;;) {
        if (inData) {
          const end = buf.indexOf('\r\n.\r\n');
          if (end === -1) return;
          mail.data = buf.slice(0, end);
          buf = buf.slice(end + 5);
          inData = false;
          mails.push(mail);
          mail = { from: '', to: [], data: '' };
          socket.write('250 queued\r\n');
          continue;
        }
        const nl = buf.indexOf('\r\n');
        if (nl === -1) return;
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        const cmd = line.toUpperCase();
        if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) socket.write('250-fake-smtp\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        else if (cmd.startsWith('AUTH PLAIN')) socket.write('235 ok\r\n');
        else if (cmd.startsWith('AUTH LOGIN')) socket.write('334 VXNlcm5hbWU6\r\n');
        else if (cmd.startsWith('MAIL FROM')) {
          mail.from = line.slice(10);
          socket.write('250 ok\r\n');
        } else if (cmd.startsWith('RCPT TO')) {
          mail.to.push(/<([^>]+)>/.exec(line)?.[1] ?? line);
          socket.write('250 ok\r\n');
        } else if (cmd === 'DATA') {
          inData = true;
          socket.write('354 go\r\n');
        } else if (cmd === 'QUIT') {
          socket.write('221 bye\r\n');
          socket.end();
        } else if (/^[A-Za-z0-9+/=]+$/.test(line)) socket.write(line.length > 12 ? '235 ok\r\n' : '334 UGFzc3dvcmQ6\r\n');
        else socket.write('250 ok\r\n');
      }
    });
    socket.on('error', () => {});
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as AddressInfo).port, mails }));
  });
}

describe('verification emails are really delivered over SMTP', () => {
  let smtp: Awaited<ReturnType<typeof startFakeSmtp>>;
  let api: http.Server;
  let base = '';
  const realEnv = process.env.NODE_ENV;

  before(async () => {
    smtp = await startFakeSmtp();
    // NODE_ENV is only 'test' for the other suites; here the real SMTP path must run.
    process.env.NODE_ENV = 'development';
    const { config } = await import('../config');
    Object.assign(config.notify.smtp, { host: '127.0.0.1', port: smtp.port, secure: false, user: 'shop@duhahe.test', pass: 'app-password', from: 'Duhahe <shop@duhahe.test>' });
    (await import('../services/notify')).resetTransport();
    const { createApp } = await import('../app');
    api = http.createServer(await createApp()).listen(0);
    base = `http://127.0.0.1:${(api.address() as AddressInfo).port}/api`;
  });

  after(() => {
    process.env.NODE_ENV = realEnv;
    api.close();
    smtp.server.close();
  });

  it('the code arrives in the inbox that was typed, and completes the sign-up', async () => {
    const GOOD = 'Str0ng!Pass';
    const signup = await fetch(`${base}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Marie Claire', email: 'Marie.Claire@Example.com', phone: '0788000111', password: GOOD, confirmPassword: GOOD }),
    });
    assert.equal(signup.status, 202);

    assert.equal(smtp.mails.length, 1, 'exactly one email is sent');
    const mail = smtp.mails[0];
    assert.deepEqual(mail.to, ['marie.claire@example.com']);
    assert.match(mail.from, /shop@duhahe\.test/);
    assert.match(mail.data, /Subject: Your Duhahe Rwanda Market verification code/);
    const code = /verification code is (\d{6})/.exec(mail.data)?.[1];
    assert.ok(code, 'the email contains a 6-digit code');

    const verify = await fetch(`${base}/auth/signup/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'marie.claire@example.com', emailCode: code }),
    });
    assert.equal(verify.status, 201);
    const body = (await verify.json()) as { data: { token: string; user: { email: string } } };
    assert.ok(body.data.token);
    assert.equal(body.data.user.email, 'marie.claire@example.com');
  });

  it('when the mail server is unreachable the sign-up is refused and nothing is created', async () => {
    const { config } = await import('../config');
    const { resetTransport } = await import('../services/notify');
    const realPort = config.notify.smtp.port;
    smtp.server.close();
    Object.assign(config.notify.smtp, { port: 1 }); // nothing listens here
    resetTransport();
    try {
      const GOOD = 'Str0ng!Pass';
      const res = await fetch(`${base}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'No Mail', email: 'nomail@example.com', phone: '0722000999', password: GOOD, confirmPassword: GOOD }),
      });
      assert.equal(res.status, 502);
      // No pending sign-up was kept: verifying any code fails as "expired".
      const v = await fetch(`${base}/auth/signup/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nomail@example.com', emailCode: '123456' }),
      });
      assert.equal(v.status, 410);
    } finally {
      Object.assign(config.notify.smtp, { port: realPort });
      resetTransport();
    }
  });
});
