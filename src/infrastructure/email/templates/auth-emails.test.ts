import { describe, expect, it } from 'vitest';
import {
  emailChangeEmail,
  passwordResetEmail,
  resendOtpEmail,
  signupOtpEmail,
} from './auth-emails.js';
import { escapeHtml } from './layout.js';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    );
  });
});

describe.each([
  ['signupOtpEmail', signupOtpEmail, 'Verify your GridX account'],
  ['resendOtpEmail', resendOtpEmail, 'Your new GridX verification code'],
])('%s', (_name, template, subject) => {
  it('includes the OTP and expiry in both HTML and text bodies', () => {
    const email = template({ name: 'Ada', otp: '482913', expiresInMinutes: 10 });

    expect(email.subject).toBe(subject);
    expect(email.text).toContain('482913');
    expect(email.text).toContain('10 minutes');
    expect(email.text).toContain('Hi Ada,');
    expect(email.html).toContain('482913');
    expect(email.html).toContain('10 minutes');
    expect(email.html).toContain('Hi Ada,');
  });

  it('falls back to a generic greeting when the name is missing', () => {
    const email = template({ name: null, otp: '482913', expiresInMinutes: 10 });

    expect(email.text).toContain('Hi there,');
    expect(email.html).toContain('Hi there,');
  });

  it('escapes the user name in the HTML body', () => {
    const email = template({ name: '<script>x</script>', otp: '482913', expiresInMinutes: 10 });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });
});

describe.each([
  [
    'emailChangeEmail',
    emailChangeEmail,
    'Verify your new GridX email address',
    'Verify email address',
  ],
  ['passwordResetEmail', passwordResetEmail, 'Reset your GridX password', 'Reset password'],
])('%s', (_name, template, subject, buttonLabel) => {
  const url = 'http://localhost:3000/action?token=abc123';

  it('includes the link, button and expiry in both HTML and text bodies', () => {
    const email = template({ name: 'Ada', url, expiresInMinutes: 15 });

    expect(email.subject).toBe(subject);
    expect(email.text).toContain(url);
    expect(email.text).toContain('15 minutes');
    expect(email.html).toContain(`href="${url}"`);
    expect(email.html).toContain(buttonLabel);
    expect(email.html).toContain('15 minutes');
    expect(email.html).not.toContain('{expiry}');
  });

  it('escapes special characters in the link', () => {
    const email = template({ name: 'Ada', url: `${url}&next="/x"`, expiresInMinutes: 15 });

    expect(email.html).toContain('&amp;next=&quot;/x&quot;');
    expect(email.html).not.toContain('"/x"');
  });
});
