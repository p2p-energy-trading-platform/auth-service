import { describe, expect, it, vi } from 'vitest';

const { sendMock, clientOptionsMock } = vi.hoisted(() => ({
  sendMock: vi.fn<() => Promise<void>>(),
  clientOptionsMock: vi.fn<(options: unknown) => void>(),
}));

vi.mock('mailtrap', () => ({
  MailtrapClient: class {
    constructor(options: unknown) {
      clientOptionsMock(options);
    }
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
      sandbox: true,
      testInboxId: 4953308,
    });

    expect(clientOptionsMock).toHaveBeenCalledWith({
      token: 'test-api-key',
      sandbox: true,
      testInboxId: 4953308,
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
      sandbox: true,
      testInboxId: 4953308,
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
      sandbox: true,
      testInboxId: 4953308,
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
