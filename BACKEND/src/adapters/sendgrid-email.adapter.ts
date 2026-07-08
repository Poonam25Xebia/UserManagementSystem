/**
 * sendgrid-email.adapter.ts
 *
 * Concrete implementation of EmailDeliveryPort that wraps @sendgrid/mail.
 *
 * Design rules:
 *  - NEVER throws — all SendGrid errors are caught and returned as
 *    { success: false, error: <message> }
 *  - sendgridApiKey is sourced from appConfig and is NEVER logged
 *
 * Requirements: US-073 FR-004–005, FR-012
 */

import sgMail from '@sendgrid/mail';
import { EmailDeliveryPort } from './email-delivery.port';
import { DeliveryResult, EmailRecipient } from '../types/registration.types';
import { appConfig } from '../config/app.config';

export class SendGridEmailAdapter implements EmailDeliveryPort {
  constructor() {
    // Configure SendGrid client once at construction time.
    // The key is read from appConfig — never logged or exposed.
    sgMail.setApiKey(appConfig.sendgridApiKey);
  }

  async sendTransactional(
    recipient: EmailRecipient,
    subject: string,
    templateId: string,
    templateVars: Record<string, string>,
  ): Promise<DeliveryResult> {
    try {
      const [response] = await sgMail.send({
        to: { email: recipient.address, name: recipient.name },
        from: { email: appConfig.fromEmail, name: appConfig.fromName },
        subject,
        templateId,
        dynamicTemplateData: templateVars,
      });

      // SendGrid returns 202 Accepted on success
      const messageId = (response.headers['x-message-id'] as string | undefined) ?? undefined;
      return { success: true, messageId };
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown SendGrid error';
      // Log a structured error — but NEVER log the API key
      console.error('[SendGridEmailAdapter] Delivery failed:', {
        recipient: recipient.address,
        templateId,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }
}
