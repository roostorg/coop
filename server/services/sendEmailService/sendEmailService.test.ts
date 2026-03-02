import { type SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

import makeSendEmail, {
  CoopEmailAddress,
  makeSendEmailViaSendGrid,
  type Message,
} from './sendEmailService.js';

function makeMockClient() {
  const mockSend = jest.fn().mockResolvedValue({ MessageId: 'test-message-id' });
  const mockClient = { send: mockSend } as unknown as SESClient;
  return { mockSend, mockClient };
}

describe('sendEmailService', () => {
  describe('SES backend (default)', () => {
    it('should create a function', () => {
      const { mockClient } = makeMockClient();
      const sendEmail = makeSendEmail(mockClient);
      expect(typeof sendEmail).toBe('function');
    });

    it('should send email with correct SES parameters', async () => {
      const { mockSend, mockClient } = makeMockClient();
      const sendEmail = makeSendEmail(mockClient);

      const msg: Message = {
        to: 'recipient@example.com',
        from: CoopEmailAddress.NoReply,
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      };

      await sendEmail(msg);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(SendEmailCommand);
      expect(command.input).toEqual({
        Source: CoopEmailAddress.NoReply,
        Destination: {
          ToAddresses: ['recipient@example.com'],
        },
        Message: {
          Subject: { Charset: 'UTF-8', Data: 'Test Subject' },
          Body: {
            Html: { Charset: 'UTF-8', Data: '<p>Hello</p>' },
          },
        },
      });
    });

    it('should format Source as "Name <email>" for object from address', async () => {
      const { mockSend, mockClient } = makeMockClient();
      const sendEmail = makeSendEmail(mockClient);

      const msg: Message = {
        to: 'recipient@example.com',
        from: { name: 'Coop', email: CoopEmailAddress.NoReply },
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      };

      await sendEmail(msg);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Source).toBe(
        `Coop <${CoopEmailAddress.NoReply}>`,
      );
    });

    it('should use Body.Text instead of Body.Html for text content', async () => {
      const { mockSend, mockClient } = makeMockClient();
      const sendEmail = makeSendEmail(mockClient);

      const msg: Message = {
        to: 'recipient@example.com',
        from: CoopEmailAddress.NoReply,
        subject: 'Test Subject',
        text: 'Hello plain text',
      };

      await sendEmail(msg);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Message.Body).toEqual({
        Text: { Charset: 'UTF-8', Data: 'Hello plain text' },
      });
    });

    it('should pass array directly to ToAddresses', async () => {
      const { mockSend, mockClient } = makeMockClient();
      const sendEmail = makeSendEmail(mockClient);

      const msg: Message = {
        to: ['a@example.com', 'b@example.com'],
        from: CoopEmailAddress.NoReply,
        subject: 'Test',
        text: 'Hello',
      };

      await sendEmail(msg);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Destination.ToAddresses).toEqual([
        'a@example.com',
        'b@example.com',
      ]);
    });

    it('should not throw when SES returns an error', async () => {
      const { mockSend, mockClient } = makeMockClient();
      mockSend.mockRejectedValueOnce(new Error('SES error'));
      const sendEmail = makeSendEmail(mockClient);

      const msg: Message = {
        to: 'recipient@example.com',
        from: CoopEmailAddress.NoReply,
        subject: 'Test',
        text: 'Hello',
      };

      await expect(sendEmail(msg)).resolves.not.toThrow();
    });

    it('should log the error when SES fails', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const { mockSend, mockClient } = makeMockClient();
      mockSend.mockRejectedValueOnce(new Error('MessageRejected'));
      const sendEmail = makeSendEmail(mockClient);

      const msg: Message = {
        to: 'recipient@example.com',
        from: CoopEmailAddress.NoReply,
        subject: 'Test',
        text: 'Hello',
      };

      await sendEmail(msg);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send email:',
        'MessageRejected',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('SendGrid backend', () => {
    it('should create a function when given an API key', () => {
      const sendEmail = makeSendEmailViaSendGrid('SG.test-key');
      expect(typeof sendEmail).toBe('function');
    });
  });

  describe('CoopEmailAddress defaults', () => {
    it('should have default email addresses', () => {
      expect(CoopEmailAddress.NoReply).toBeDefined();
      expect(CoopEmailAddress.Support).toBeDefined();
      expect(CoopEmailAddress.Team).toBeDefined();
    });
  });
});
