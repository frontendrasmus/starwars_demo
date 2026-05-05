import type { AttractionsData } from "@chat-demo/shared";

/**
 * Inline widget for the attractions follow-up. Receives the structured
 * payload as the `data` prop on a `data-attractions` UI message part.
 */
export function AttractionsCard({ data }: { data: AttractionsData }) {
  if (!data) return null;
  const { city, country, attractions } = data;

  return (
    <article
      className="attractions-card"
      aria-label={`Top attractions in ${city}`}
    >
      <header className="ac-header">
        <span className="ac-kicker">Top 3 attractions · {country}</span>
        <h2 className="ac-title">
          <em>{city}</em>
        </h2>
      </header>

      <ol className="ac-list">
        {attractions.map((a, i) => (
          <li key={i} className="ac-item">
            <div className="ac-image">
              {a.image ? (
                <a
                  href={a.image.sourceUrl ?? "#"}
                  target="_blank"
                  rel="noopener"
                  title={`${a.image.caption} — ${a.image.attribution}`}
                >
                  <img src={a.image.url} alt={a.image.caption} loading="lazy" />
                </a>
              ) : (
                <div className="ac-image-placeholder" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </div>
              )}
            </div>
            <div className="ac-content">
              <div className="ac-num">#{i + 1}</div>
              <h3 className="ac-name">{a.name}</h3>
              <div className="ac-meta">
                <span>{a.category}</span>
                <span>{a.estimatedDuration}</span>
                <span>{a.bestTime}</span>
              </div>
              <p className="ac-desc">{a.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
