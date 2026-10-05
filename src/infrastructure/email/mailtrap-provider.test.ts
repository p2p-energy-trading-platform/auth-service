import { describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn<() => Promise<void>>();

vi.mock('mailtrap', () => ({
  MailtrapClient: class {
    send = sendMock;
  },
}));

import { MailtrapEmailProvider } from './mailtrap-provider.js';

describe('MailtrapEmailProvider', () => {
  it('sends an email through Mailtrap', async () => {
    sendMock.mockResolvedValue(undefined);

    const provider = new MailtrapEmailProvider({
      apiKey: 'test-api-key',
      fromEmail: 'noreply@example.com',
      fromName: 'GridX',
    });

    await provider.send({
      to: 'user@example.com',
      subject: 'Password reset',
      text: 'Reset your password.',
      html: '<p>Reset your password.</p>',
    });

    expect(sendMock).toHaveBeenCalledWith({
      from: {
        email: 'noreply@example.com',
        name: 'GridX',
      },
      to: [{ email: 'user@example.com' }],
      subject: 'Password reset',
      text: 'Reset your password.',
      html: '<p>Reset your password.</p>',
    });
  });

  it('supports plain-text emails without HTML', async () => {
    sendMock.mockResolvedValue(undefined);

    const provider = new MailtrapEmailProvider({
      apiKey: 'test-api-key',
      fromEmail: 'noreply@example.com',
      fromName: 'GridX',
    });

    await provider.send({
      to: 'user@example.com',
      subject: 'Test email',
      text: 'Test message.',
    });

    expect(sendMock).toHaveBeenCalledWith({
      from: {
        email: 'noreply@example.com',
        name: 'GridX',
      },
      to: [{ email: 'user@example.com' }],
      subject: 'Test email',
      text: 'Test message.',
    });
  });

  it('propagates Mailtrap errors', async () => {
    sendMock.mockRejectedValueOnce(new Error('Mailtrap request failed'));

    const provider = new MailtrapEmailProvider({
      apiKey: 'test-api-key',
      fromEmail: 'noreply@example.com',
      fromName: 'GridX',
    });

    await expect(
      provider.send({
        to: 'user@example.com',
        subject: 'Test email',
        text: 'Test message.',
      }),
    ).rejects.toThrow('Mailtrap request failed');
  });
});
