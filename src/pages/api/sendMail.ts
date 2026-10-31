import { NextApiRequest, NextApiResponse } from "next";
import { sendMail as send } from "@/lib/mailer";
import { clientIp, createRateLimiter } from "@/lib/rateLimit";
import { readEmail, readEnum, readText, sendApiError } from "@/lib/validate";
import { CONTACT_SUBJECTS } from "@/lib/contact";

const limiter = createRateLimiter(5, 60 * 60 * 1000);

export default async function sendMail(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body ?? {};
  // Hidden field that only bots fill in
  if (body.website) return res.status(200).json({ ok: true });
  if (!limiter.take(clientIp(req))) {
    return res.status(429).json({ ok: false, error: "Too many messages from your connection. Please email me directly." });
  }

  try {
    const name = readText(body.NAME, "NAME", { label: "Name", max: 100, required: true });
    const email = readEmail(body.EMAIL, "EMAIL");
    const subject = readEnum(body.SUBJECT, "SUBJECT", CONTACT_SUBJECTS, "Subject");
    const message = readText(body.MESSAGE, "MESSAGE", { label: "Message", max: 5000, required: true, multiline: true });
    // Plain text, so nothing a visitor types is rendered as HTML in your inbox
    const sent = await send({
      to: process.env.EMAIL_TO || process.env.ADMIN_EMAIL || "",
      replyTo: email,
      subject: `Contact form: ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
    });
    if (!sent) return res.status(502).json({ ok: false, error: "Your message couldn't be sent. Please email me directly." });
    return res.status(200).json({ ok: true, message: "Email sent successfully" });
  } catch (err) {
    return sendApiError(res, err);
  }
}
