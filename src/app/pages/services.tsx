import Link from "next/link";
import { splitLines, splitTags, type ContentRow } from "@/lib/content";
import { ServiceIconView } from "@/lib/serviceIcons";

export default function Services({ items, industries = [] }: { items: ContentRow[]; industries?: ContentRow[] }) {
  if (items.length === 0) return null;

  return (
    <section
      id="services"
      className="w-full bg-backgroundColour scroll-mt-20"
      aria-labelledby="services-heading"
    >
      <div className="section-container">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="eyebrow">Services</p>
            <h2 id="services-heading" className="section-title">What I can build for you</h2>
            <p className="text-lg mt-4 text-mutedColour max-w-3xl">
              Software shaped around how your business already works, not the other way round. I handle
              everything from the first conversation to hosting and support, so you deal with one person throughout.
            </p>
          </div>
          <Link href="/book" className="btn-primary shrink-0">Talk it through</Link>
        </div>

        {industries.length > 0 && (
          <nav aria-label="Industries" className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-mutedColour">Who I work with:</span>
            {industries.map((industry) => (
              <Link key={industry.id} href={`/industries/${industry.slug}`} className="chip hover:border-accentColour hover:text-accentColour">
                {industry.name}
              </Link>
            ))}
          </nav>
        )}

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((service) => {
            return (
              <article key={service.id} className="card p-6 flex flex-col hover:border-accentColour/60">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accentColour/10 text-2xl text-accentColour" aria-hidden>
                    <ServiceIconView name={service.icon} />
                  </span>
                  <h3 className="text-xl font-FiraSans-Bold text-textColour">
                    {service.details && service.slug ? (
                      <Link href={`/services/${service.slug}`} className="hover:text-accentColour hover:cursor-finger">{service.title}</Link>
                    ) : (
                      service.title
                    )}
                  </h3>
                </div>
                {service.description && <p className="mt-4 text-mutedColour leading-relaxed">{service.description}</p>}
                <ul className="mt-4 space-y-1 text-sm text-mutedColour list-disc pl-5 marker:text-accentColour flex-grow">
                  {splitLines(service.examples).map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {splitTags(service.tech).map((tech) => (
                      <span key={tech} className="chip">{tech}</span>
                    ))}
                  </div>
                  {service.priceFrom && <p className="text-sm font-FiraSans-SemiBold text-textColour">{service.priceFrom}</p>}
                </div>
                {service.details && service.slug && (
                  <Link href={`/services/${service.slug}`} className="mt-4 text-sm font-FiraSans-SemiBold text-accentColour hover:underline">
                    More about {String(service.title).toLowerCase()} →
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
