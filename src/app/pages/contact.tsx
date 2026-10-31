"use client";

//import TextBox from "../components/inputs/textbox"
//import InputField from "../components/inputs/inputField"
//impout Selectbox from "../components/inputs/selectbox"
import Link from "next/link";
import { FaLinkedin } from "react-icons/fa6";
import { MdOutlineCalendarMonth, MdOutlineEmail, MdOutlinePhone } from "react-icons/md";
import { Bounce, toast } from "react-toastify";
import { CONTACT_SUBJECTS } from "@/lib/contact";

const EmailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

export default function Contact({ email, phone, linkedin }: { email: string; phone: string; linkedin?: string }) {

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = (document.getElementById("name") as HTMLInputElement).value;
    const email = (document.getElementById("email") as HTMLInputElement).value;
    const subject = (document.getElementById("subject") as HTMLSelectElement)
      .value;
    const message = (document.getElementById("message") as HTMLTextAreaElement)
      .value;
    const website = (document.getElementById("website") as HTMLInputElement).value;

    if (name === "" || email === "" || subject === "" || message === "") {
      toast.error("❌ Empty fields", {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: true,
        progress: undefined,
        theme: "dark",
        transition: Bounce,
      });
      return;
    } else if (!EmailRegex.test(email)) {
      toast.error(
        "Invalid email address. Please check your email and try again",
        {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: true,
          progress: undefined,
          theme: "dark",
          transition: Bounce,
        }
      );
      return;
    }
    try {
      const Response = await fetch('/api/sendMail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          NAME: name,
          EMAIL: email,
          SUBJECT: subject,
          MESSAGE: message,
          website,
        }),
      });

      if (Response.ok) {
        toast.success("✉️ Email was sent successfully", {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: true,
          progress: undefined,
          theme: "dark",
          transition: Bounce,
        });
        (e.target as HTMLFormElement).reset();
      } else {
        const json = await Response.json().catch(() => ({}));
        throw new Error(json.error ?? "Please try again");
      }

    } catch (err) {
      toast.error(`❌ Your message could not be sent. ${(err as Error).message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: true,
        progress: undefined,
        theme: "dark",
        transition: Bounce,
      });
    }
  };

  return (
    <section id="contact-me" className="w-full bg-backgroundColour scroll-mt-20" aria-labelledby="contact-heading">
      <div className="section-container">
        <p className="eyebrow">Contact</p>
        <h2 id="contact-heading" className="section-title">Let&apos;s talk about your business</h2>
        <p className="text-lg mt-4 text-mutedColour max-w-3xl">
          The quickest way to start is a free 20-minute call. Prefer to write it down? Send me a message
          and I&apos;ll reply within one working day.
        </p>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-5 gap-8">
          <form id="contact-form" onSubmit={handleSubmit} className="lg:col-span-3 card p-6 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                className="w-full bg-secondaryColour text-textColour rounded-lg border border-borderColour py-3 px-4 leading-tight focus:outline-none focus:border-accentColour placeholder:text-mutedColour"
                id="name"
                type="text"
                placeholder="Full name"
                aria-label="Full name"
              />
              <input
                className="w-full bg-secondaryColour text-textColour rounded-lg border border-borderColour py-3 px-4 leading-tight focus:outline-none focus:border-accentColour placeholder:text-mutedColour"
                id="email"
                type="email"
                placeholder="Email address"
                aria-label="Email address"
              />
            </div>
            <select
              className="w-full bg-secondaryColour text-textColour rounded-lg border border-borderColour py-3 px-4 leading-tight focus:outline-none focus:border-accentColour placeholder:text-mutedColour"
              id="subject"
              aria-label="Subject"
              defaultValue=""
            >
              <option value="" disabled>What&apos;s this about?</option>
              {CONTACT_SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
            <textarea
              className="w-full bg-secondaryColour text-textColour rounded-lg border border-borderColour py-3 px-4 leading-tight focus:outline-none focus:border-accentColour placeholder:text-mutedColour h-48"
              id="message"
              placeholder="Your message"
              aria-label="Your message"
            />
            {/* Hidden from people; bots fill it in and are ignored */}
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
            <div>
              <button type="submit" id="submit" className="btn-primary w-full sm:w-auto">
                Send message
              </button>
            </div>
          </form>

          <div className="lg:col-span-2 flex flex-col gap-4">
            <Link href="/book" className="card p-5 flex items-center gap-4 border-accentColour/60 hover:border-accentColour hover:cursor-finger">
              <MdOutlineCalendarMonth className="text-3xl text-accentColour shrink-0" aria-hidden />
              <div>
                <p className="font-FiraSans-Bold">Book a free 20-minute call</p>
                <p className="text-sm text-mutedColour">Pick a time that suits you, by phone or video</p>
              </div>
            </Link>
            <a href={`mailto:${email}`} className="card p-5 flex items-center gap-4 hover:border-accentColour/60 hover:cursor-finger">
              <MdOutlineEmail className="text-3xl text-accentColour shrink-0" aria-hidden />
              <div>
                <p className="font-FiraSans-Bold">Email</p>
                <p className="text-sm text-mutedColour">{email}</p>
              </div>
            </a>
            {phone && (
              <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="card p-5 flex items-center gap-4 hover:border-accentColour/60 hover:cursor-finger">
                <MdOutlinePhone className="text-3xl text-accentColour shrink-0" aria-hidden />
                <div>
                  <p className="font-FiraSans-Bold">Phone</p>
                  <p className="text-sm text-mutedColour">{phone}</p>
                </div>
              </a>
            )}
            {linkedin && (
              <a href={linkedin} target="_blank" rel="noreferrer" className="card p-5 flex items-center gap-4 hover:border-accentColour/60 hover:cursor-finger">
                <FaLinkedin className="text-3xl text-accentColour shrink-0" aria-hidden />
                <div>
                  <p className="font-FiraSans-Bold">LinkedIn</p>
                  <p className="text-sm text-mutedColour">Connect with me</p>
                </div>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
