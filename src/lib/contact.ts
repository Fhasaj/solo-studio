/*
 * @name: Contact form
 * @description: The subjects offered on the contact form. Shared by the form and /api/sendMail, which rejects anything else.
 * */

export const CONTACT_SUBJECTS = [
  "New business system",
  "Mobile app",
  "Fix or extend an existing system",
  "Support for an existing project",
  "Something else",
] as const;
