import dotenv from 'dotenv';
dotenv.config();

import sgMail from '@sendgrid/mail';

const apiKey = process.env.SENDGRID_API_KEY;
const from = process.env.FROM_EMAIL;
const to = process.argv[2];

if (!apiKey) throw new Error('SENDGRID_API_KEY is not set in .env');
if (!from) throw new Error('FROM_EMAIL is not set in .env');
if (!to) throw new Error('Usage: ts-node scripts/test-sendgrid.ts <recipient-email>');

sgMail.setApiKey(apiKey);

sgMail
  .send({
    to,
    from,
    subject: 'SendGrid test email',
    text: 'This is a test email to verify SendGrid delivery is working.',
    html: '<strong>This is a test email to verify SendGrid delivery is working.</strong>',
  })
  .then(() => console.log('Email sent to', to))
  .catch((error) => {
    console.error(error.response?.body ?? error);
    process.exit(1);
  });
