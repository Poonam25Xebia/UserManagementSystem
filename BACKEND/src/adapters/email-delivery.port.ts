/**
 * email-delivery.port.ts
 *
 * Provider-agnostic interface for outbound transactional email.
 * Concrete adapters (e.g. SendGridEmailAdapter) implement this interface.
 *
 * Requirements: US-073 ADR-002, FR-004–005, FR-012
 */

import { DeliveryResult, EmailRecipient } from '../types/registration.types';

export interface EmailDeliveryPort {
  /**
   * Send a transactional email using a provider template.
   *
   * NEVER throws — returns { success: false, error } on any provider failure.
   *
   * @param recipient    - Destination address and display name
   * @param subject      - Email subject line
   * @param templateId   - Provider-specific template identifier
   * @param templateVars - Dynamic template variable substitutions
   */
  sendTransactional(
    recipient: EmailRecipient,
    subject: string,
    templateId: string,
    templateVars: Record<string, string>,
  ): Promise<DeliveryResult>;
}
