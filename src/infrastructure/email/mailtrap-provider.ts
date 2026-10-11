import { MailtrapClient } from 'mailtrap';
import type { EmailMessage, EmailProvider } from './provider.js';

export interface MailtrapProviderOptions {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  sandbox: boolean;
  testInboxId?: number;
}

export class MailtrapEmailProvider implements EmailProvider {
  private readonly client: MailtrapClient;
  private readonly from: {
    email: string;
    name: string;
  };

  constructor(options: MailtrapProviderOptions) {
    this.client = new MailtrapClient({
      token: options.apiKey,
      sandbox: options.sandbox,
      ...(options.testInboxId !== undefined ? { testInboxId: options.testInboxId } : {}),
    });

    this.from = {
      email: options.fromEmail,
      name: options.fromName,
    };
  }

  async send(message: EmailMessage): Promise<void> {
    await this.client.send({
      from: this.from,
      to: [{ email: message.to }],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    });
  }
}
