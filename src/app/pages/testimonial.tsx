import type { ContentRow } from "@/lib/content";

export default function TestimonialSection({ items }: { items: ContentRow[] }) {
  if (items.length === 0) return null;

  return (
    <section
      id="testimonials"
      className="w-full bg-backgroundColour scroll-mt-20"
      aria-labelledby="testimonials-heading"
    >
      <div className="section-container">
        <p className="eyebrow">Testimonials</p>
        <h2 id="testimonials-heading" className="section-title">What clients say</h2>

        <div className="mt-10 w-full grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((testimonial) => (
            <figure key={testimonial.id} className="card p-6 flex flex-col">
              <blockquote className="text-lg text-textColour leading-relaxed flex-grow">
                <p>&ldquo;{testimonial.quote}&rdquo;</p>
              </blockquote>
              <figcaption className="mt-5 text-sm">
                <span className="font-FiraSans-Bold text-textColour">{testimonial.name}</span>
                {testimonial.role && <span className="text-mutedColour">, {testimonial.role}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
