import type { EmailMessage } from '../provider.js';
import {
  button,
  callout,
  codeBlock,
  escapeHtml,
  fallbackLink,
  paragraph,
  renderLayout,
  renderText,
  strong,
} from './layout.js';

export type EmailContent = Omit<EmailMessage, 'to'>;

const greeting = (name: string | null | undefined): string =>
  name?.trim() ? `Hi ${name.trim()},` : 'Hi there,';

const minutes = (value: number): string => `${value} ${value === 1 ? 'minute' : 'minutes'}`;

interface OtpEmailInput {
  name?: string | null;
  otp: string;
  expiresInMinutes: number;
}

interface OtpEmailCopy {
  subject: string;
  heading: string;
  intro: string;
}

const SECURITY_NOTE = 'Never share this code with anyone. GridX staff will never ask for it.';
const SIGNUP_FOOTER =
  "You're receiving this email because this address was used to create a GridX account. If that wasn't you, you can safely ignore it.";

const otpEmail = (input: OtpEmailInput, copy: OtpEmailCopy): EmailContent => ({
  subject: copy.subject,
  text: renderText([
    greeting(input.name),
    '',
    copy.intro,
    '',
    `Verification code: ${input.otp}`,
    '',
    `This code expires in ${minutes(input.expiresInMinutes)}.`,
    SECURITY_NOTE,
    '',
    SIGNUP_FOOTER,
  ]),
  html: renderLayout({
    preheader: `${input.otp} is your GridX verification code. It expires in ${minutes(input.expiresInMinutes)}.`,
    heading: copy.heading,
    bodyHtml: [
      paragraph(escapeHtml(greeting(input.name))),
      paragraph(escapeHtml(copy.intro)),
      codeBlock(input.otp),
      paragraph(`This code expires in ${strong(minutes(input.expiresInMinutes))}.`),
      callout(escapeHtml(SECURITY_NOTE)),
    ].join(''),
    footerNote: SIGNUP_FOOTER,
  }),
});

export const signupOtpEmail = (input: OtpEmailInput): EmailContent =>
  otpEmail(input, {
    subject: 'Verify your GridX account',
    heading: 'Verify your email address',
    intro:
      'Welcome to GridX! Enter the code below to verify your email address and activate your account.',
  });

export const resendOtpEmail = (input: OtpEmailInput): EmailContent =>
  otpEmail(input, {
    subject: 'Your new GridX verification code',
    heading: 'Here is your new code',
    intro:
      'You asked for a new verification code. Enter it below to finish setting up your account. Any code we sent earlier no longer works.',
  });

interface LinkEmailInput {
  name?: string | null;
  url: string;
  expiresInMinutes: number;
}

interface LinkEmailCopy {
  subject: string;
  heading: string;
  preheader: string;
  intro: string;
  buttonLabel: string;
  expiryNote: string;
  ignoreNote: string;
}

const linkEmail = (input: LinkEmailInput, copy: LinkEmailCopy): EmailContent => ({
  subject: copy.subject,
  text: renderText([
    greeting(input.name),
    '',
    copy.intro,
    '',
    `${copy.buttonLabel}: ${input.url}`,
    '',
    `${copy.expiryNote.replace('{expiry}', minutes(input.expiresInMinutes))}`,
    '',
    copy.ignoreNote,
  ]),
  html: renderLayout({
    preheader: copy.preheader,
    heading: copy.heading,
    bodyHtml: [
      paragraph(escapeHtml(greeting(input.name))),
      paragraph(escapeHtml(copy.intro)),
      button(copy.buttonLabel, input.url),
      paragraph(
        escapeHtml(copy.expiryNote).replace('{expiry}', strong(minutes(input.expiresInMinutes))),
      ),
      fallbackLink(input.url),
    ].join(''),
    footerNote: copy.ignoreNote,
  }),
});

export const emailChangeEmail = (input: LinkEmailInput): EmailContent =>
  linkEmail(input, {
    subject: 'Verify your new GridX email address',
    heading: 'Confirm your new email address',
    preheader: 'Confirm this address to finish updating your GridX account.',
    intro:
      'We received a request to change the email address on your GridX account to this one. Confirm it below to complete the change.',
    buttonLabel: 'Verify email address',
    expiryNote: 'This link expires in {expiry}.',
    ignoreNote:
      "If you didn't request this change, you can safely ignore this email. Your account email will stay the same.",
  });

export const passwordResetEmail = (input: LinkEmailInput): EmailContent =>
  linkEmail(input, {
    subject: 'Reset your GridX password',
    heading: 'Reset your password',
    preheader: 'Use this link to choose a new password for your GridX account.',
    intro:
      'We received a request to reset the password for your GridX account. Choose a new password using the button below.',
    buttonLabel: 'Reset password',
    expiryNote: 'This link expires in {expiry} and can only be used once.',
    ignoreNote:
      "If you didn't request a password reset, you can safely ignore this email. Your password won't change.",
  });
