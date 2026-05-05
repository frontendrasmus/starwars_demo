import type { CostsData } from "@chat-demo/shared";

/**
 * Inline widget for the costs follow-up. Receives the structured
 * payload as the `data` prop on a `data-costs` UI message part.
 */
export function CostsCard({ data }: { data: CostsData }) {
  if (!data) return null;
  const { city, country, currency, daily, breakdown, notes } = data;

  return (
    <article className="costs-card" aria-label={`Travel costs for ${city}`}>
      <header className="cc-header">
        <span className="cc-kicker">Travel costs · {country}</span>
        <h2 className="cc-title">
          <em>{city}</em>
        </h2>
      </header>

      <section className="cc-section">
        <h3 className="cc-section-label">Daily total per person ({currency})</h3>
        <div className="cc-tiers">
          <Tier label="Budget" value={daily.budget} currency={currency} />
          <Tier
            label="Mid-range"
            value={daily.midRange}
            currency={currency}
            highlight
          />
          <Tier label="Luxury" value={daily.luxury} currency={currency} />
        </div>
      </section>

      <section className="cc-section">
        <h3 className="cc-section-label">Breakdown</h3>
        <dl className="cc-breakdown">
          <Row label="Accommodation" value={breakdown.accommodation} />
          <Row label="Food" value={breakdown.food} />
          <Row label="Transport" value={breakdown.transport} />
          <Row label="Attractions" value={breakdown.attractions} />
          {breakdown.flightFromMajorEU && (
            <Row label="Flight (EU)" value={breakdown.flightFromMajorEU} />
          )}
        </dl>
      </section>

      <section className="cc-section">
        <h3 className="cc-section-label">Tips & assumptions</h3>
        <ul className="cc-notes">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function Tier({
  label,
  value,
  currency,
  highlight,
}: {
  label: string;
  value: number;
  currency: string;
  highlight?: boolean;
}) {
  return (
    <div className={`cc-tier${highlight ? " cc-tier-highlight" : ""}`}>
      <div className="cc-tier-label">{label}</div>
      <div className="cc-tier-value">
        <span className="cc-tier-num">{value.toLocaleString()}</span>
        <span className="cc-tier-currency">{shortCurrency(currency)}</span>
      </div>
    </div>
  );
}

/**
 * Compact tier label for the daily totals — full currency name lives in
 * the section header; the per-tier slot only has room for a 3-4 char
 * code (SEK / EUR / ISK / ¥). Tries the parenthesised abbreviation
 * first, falls back to the first word.
 */
function shortCurrency(currency: string): string {
  const m = currency.match(/\(([^)]+)\)/);
  if (m && m[1]) return m[1].trim();
  const firstWord = currency.trim().split(/\s+/)[0] ?? currency;
  return firstWord.length <= 5 ? firstWord : firstWord.slice(0, 3).toUpperCase();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="cc-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
