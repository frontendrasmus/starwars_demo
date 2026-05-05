import { ThreadPrimitive } from "@assistant-ui/react";
import type { BrochureData, ScrapedImageRef } from "@chat-demo/shared";

/**
 * In-chat brochure widget. Receives the structured payload as the `data`
 * prop on a `data-brochure` UI message part — see Chat.tsx where this
 * is registered with MessagePrimitive.Parts.
 *
 * Image strategy: a hero photo of the city in the header, plus a flag
 * and a city symbol (coat of arms / seal) as small badges next to the
 * Quick facts heading. All images come from Wikipedia / Wikimedia
 * Commons via the imageAgent — no generated content, no long waits.
 * Each badge links back to its Wikipedia source for attribution.
 */
export function BrochureCard({ data }: { data: BrochureData }) {
  if (!data) return null;
  const { city, overview, facts, hotel, contact, images } = data;

  return (
    <article className="brochure-card" aria-label={`Tourist brochure for ${city}`}>
      {images.hero ? (
        <div className="bc-hero">
          <img src={images.hero.url} alt={images.hero.caption} loading="lazy" />
          <div className="bc-hero-overlay">
            <span className="bc-kicker">
              Tourist brochure · {overview.country}
            </span>
            <h2 className="bc-title">
              <em>{city}</em>
            </h2>
          </div>
          <ImageCredit image={images.hero} />
        </div>
      ) : (
        <header className="bc-header">
          <span className="bc-kicker">
            Tourist brochure · {overview.country}
          </span>
          <h2 className="bc-title">
            <em>{city}</em>
          </h2>
        </header>
      )}

      <p className="bc-summary">{overview.summary}</p>

      <section className="bc-section">
        <div className="bc-facts-header">
          <h3 className="bc-section-label">Quick facts</h3>
          {(images.flag || images.citySymbol) && (
            <div className="bc-badges">
              {images.flag && <Badge image={images.flag} kind="flag" />}
              {images.citySymbol && (
                <Badge image={images.citySymbol} kind="symbol" />
              )}
            </div>
          )}
        </div>
        <dl className="bc-facts">
          <Fact label="Population" value={facts.population} />
          <Fact label="Area" value={facts.area} />
          <Fact label="Climate" value={facts.climate} />
          <Fact label="Best season" value={facts.bestSeason} />
          <Fact label="Currency" value={facts.currency} />
          <Fact label="Language" value={facts.language} />
        </dl>
        <p className="bc-fun-fact">{facts.funFact}</p>
      </section>

      <section className="bc-section">
        <h3 className="bc-section-label">Where to stay</h3>
        <div className="bc-hotel">
          <div className="bc-hotel-name">{hotel.name}</div>
          <div className="bc-hotel-meta">
            <span>{hotel.area}</span>
            <span>{hotel.priceRange}</span>
          </div>
          <p className="bc-hotel-why">{hotel.why}</p>
        </div>
      </section>

      <section className="bc-section">
        <h3 className="bc-section-label">Plan your visit</h3>
        <dl className="bc-contact">
          <ContactRow label="Office" value={contact.officeName} />
          <ContactRow label="Address" value={contact.address} />
          <ContactRow label="Phone" value={contact.phone} />
          <ContactRow label="Web" value={contact.website} link />
        </dl>
      </section>

      {/*
        Follow-up suggestions. Each click submits a controlled prompt
        that the backend recognises (see detectFollowUp() in the
        workflow). The follow-up agents read this brochure's data back
        out of the thread as memory — no re-discovery.
      */}
      <section className="bc-section bc-followups">
        <h3 className="bc-section-label">What's next</h3>
        <div className="bc-suggestions">
          <ThreadPrimitive.Suggestion
            prompt={`Show me the top 3 tourist attractions in ${city}.`}
            send
            className="bc-suggestion"
          >
            <span className="bc-suggestion-icon" aria-hidden>★</span>
            Top 3 attractions
          </ThreadPrimitive.Suggestion>
          <ThreadPrimitive.Suggestion
            prompt={`Estimate travel costs for ${city}.`}
            send
            className="bc-suggestion"
          >
            <span className="bc-suggestion-icon" aria-hidden>€</span>
            Travel costs
          </ThreadPrimitive.Suggestion>
        </div>
      </section>
    </article>
  );
}

function Badge({
  image,
  kind,
}: {
  image: ScrapedImageRef;
  kind: "flag" | "symbol";
}) {
  const label = kind === "flag" ? "Flag" : "City symbol";
  const inner = (
    <>
      <img src={image.url} alt={image.caption} loading="lazy" />
      <span className="bc-badge-label">{label}</span>
    </>
  );
  if (image.sourceUrl) {
    return (
      <a
        className="bc-badge"
        href={image.sourceUrl}
        target="_blank"
        rel="noopener"
        title={`${image.caption} — ${image.attribution}`}
      >
        {inner}
      </a>
    );
  }
  return (
    <div className="bc-badge" title={image.caption}>
      {inner}
    </div>
  );
}

function ImageCredit({ image }: { image: ScrapedImageRef }) {
  if (image.sourceUrl) {
    return (
      <a
        className="bc-hero-credit"
        href={image.sourceUrl}
        target="_blank"
        rel="noopener"
      >
        {image.attribution}
      </a>
    );
  }
  return <span className="bc-hero-credit">{image.attribution}</span>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bc-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ContactRow({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: boolean;
}) {
  if (link && value) {
    const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return (
      <div className="bc-contact-row">
        <dt>{label}</dt>
        <dd>
          <a href={href} target="_blank" rel="noopener">
            {value}
          </a>
        </dd>
      </div>
    );
  }
  return (
    <div className="bc-contact-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
