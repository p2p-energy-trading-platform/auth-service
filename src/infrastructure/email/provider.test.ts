import { describe, expect, it, vi } from 'vitest';
import type { EmailMessage, EmailProvider } from './provider.js';

describe('EmailProvider', () => {
  it('supports sending a plain-text email', async () => {
    const provider: EmailProvider = {
      send: vi.fn<EmailProvider['send']>().mockResolvedValue(undefined),
    };

    const message: EmailMessage = {
      to: 'user@example.com',
      subject: 'Password reset',
      text: 'Use this link to reset your password.',
    };

    await provider.send(message);

    expect(provider.send).toHaveBeenCalledWith(message);
  });

  it('supports an optional HTML email body', async () => {
    const provider: EmailProvider = {
      send: vi.fn<EmailProvider['send']>().mockResolvedValue(undefined),
    };

    const message: EmailMessage = {
      to: 'user@example.com',
      subject: 'Password reset',
      text: 'Use this link to reset your password.',
      html: '<p>Use this link to reset your password.</p>',
    };

    await provider.send(message);

    expect(provider.send).toHaveBeenCalledWith(message);
  });

  it('propagates provider errors', async () => {
    const error = new Error('Email delivery failed');

    const provider: EmailProvider = {
      send: vi.fn<EmailProvider['send']>().mockRejectedValue(error),
    };

    const message: EmailMessage = {
      to: 'user@example.com',
      subject: 'Test',
      text: 'Test email',
    };

    await expect(provider.send(message)).rejects.toThrow('Email delivery failed');
  });
});
