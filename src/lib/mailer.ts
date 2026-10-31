/*
 * @name: Mailer
 * @description: Sends plain-text notification emails (bookings, portal logins, payments, contracts).
 * Plain text means nothing a visitor types can be rendered as HTML in an inbox.
 * */

import nodemailer from 'nodemailer';
import { GetSiteSettings } from './query/settings.query';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: Number(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export interface Mail {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
}

// Returns false instead of throwing, so a mail outage never loses a booking or a signature
export async function sendMail(mail: Mail) {
  if (!process.env.EMAIL_HOST) {
    console.warn(`[mail] EMAIL_HOST is not set, so this email was not sent: "${mail.subject}" to ${mail.to}`);
    if (process.env.NODE_ENV !== 'production') console.info(mail.text);
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"${GetSiteSettings().siteName.replace(/"/g, '')}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      ...mail,
    });
    return true;
  } catch (err) {
    console.error(`[mail] Could not send "${mail.subject}" to ${mail.to}:`, err);
    return false;
  }
}
