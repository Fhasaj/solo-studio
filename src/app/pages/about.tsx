import Image from "next/image";
import type { SiteSettings } from "@/lib/siteSettings";
import RichText from "@/lib/richText";

// Text and image come from Settings → Your details
export default function About({ settings }: { settings: SiteSettings }) {
  const image = settings.aboutImage;
  return (
    <section id="about" className="w-full bg-backgroundColour scroll-mt-20" aria-labelledby="about-heading">
      <div className="section-container">
        <div className={`grid grid-cols-1 gap-12 items-center ${image ? "md:grid-cols-3" : ""}`}>
          {image && (
            <div className="flex justify-center md:justify-start">
              <Image
                src={image}
                alt={`${settings.ownerName}`}
                className="rounded-2xl border border-borderColour"
                width={320}
                height={320}
                sizes="320px"
                style={{ maxWidth: "100%", height: "auto" }}
              />
            </div>
          )}
          <div className={image ? "md:col-span-2" : "max-w-3xl"}>
            <p className="eyebrow">About</p>
            <h2 id="about-heading" className="section-title">{settings.aboutHeading}</h2>
            <RichText text={settings.aboutText} className="mt-6 space-y-4 text-lg text-mutedColour leading-relaxed" />
          </div>
        </div>
      </div>
    </section>
  );
}
