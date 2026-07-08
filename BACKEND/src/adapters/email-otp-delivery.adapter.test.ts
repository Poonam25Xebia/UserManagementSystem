process.env.OTP_HASH_SECRET = 'test-otp-secret';
process.env.OTP_EMAIL_TEMPLATE_ID = 'd-test-otp-template';

import { EmailOtpDeliveryAdapter } from './email-otp-delivery.adapter';
import { EmailDeliveryPort } from './email-delivery.port';
import { otpConfig } from '../config/otp.config';

describe('EmailOtpDeliveryAdapter', () => {
  let emailDeliveryPort: jest.Mocked<EmailDeliveryPort>;
  let adapter: EmailOtpDeliveryAdapter;

  beforeEach(() => {
    emailDeliveryPort = { sendTransactional: jest.fn() };
    adapter = new EmailOtpDeliveryAdapter(emailDeliveryPort);
  });

  test('records a delivered dispatch when the provider accepts it', async () => {
    emailDeliveryPort.sendTransactional.mockResolvedValue({ success: true, messageId: 'abc' });

    const result = await adapter.dispatch('user@example.test', '123456');

    expect(result).toBe(true);
    expect(emailDeliveryPort.sendTransactional).toHaveBeenCalledWith(
      { address: 'user@example.test', name: 'user@example.test' },
      expect.any(String),
      otpConfig.otpEmailTemplateId,
      expect.objectContaining({ otpCode: '123456' }),
    );
  });

  test('records a failed dispatch when the provider reports failure', async () => {
    emailDeliveryPort.sendTransactional.mockResolvedValue({ success: false, error: 'provider rejected' });

    const result = await adapter.dispatch('user@example.test', '123456');

    expect(result).toBe(false);
  });

  test('never throws — a rejected provider call is converted to a failed dispatch', async () => {
    emailDeliveryPort.sendTransactional.mockRejectedValue(new Error('network error'));

    await expect(adapter.dispatch('user@example.test', '123456')).resolves.toBe(false);
  });
});
