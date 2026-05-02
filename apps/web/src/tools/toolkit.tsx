import type { Toolkit } from "@assistant-ui/react";


type CalculateResult =
  | { ok: true; expression: string; value: number }
  | { ok: false; error: string };

type GetCurrentTimeResult =
  | { ok: true; iso: string; formatted: string; timezone: string }
  | { ok: false; error: string };

type SearchKnowledgeResult = {
  ok: true;
  query: string;
  hits: Array<{ source: string; text: string; score: number }>;
  message?: string;
};


function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function CalculatorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="13" x2="8.01" y2="13" />
      <line x1="12" y1="13" x2="12.01" y2="13" />
      <line x1="16" y1="13" x2="16.01" y2="13" />
      <line x1="8" y1="17" x2="8.01" y2="17" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
      <line x1="16" y1="17" x2="16.01" y2="17" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

export const toolkit: Toolkit = {
  calculate: {
    type: "backend",
    render: ({ result, args, status }) => {
      const typedResult = result as CalculateResult | undefined;
      if (status.type === "running" || !typedResult) {
        return (
          <div className="tool-card">
            <div className="tool-name">
              <CalculatorIcon />
              calculate
            </div>
            <div className="tool-spinner">
              Computing {(args as { expression?: string })?.expression ?? "…"}
            </div>
          </div>
        );
      }
      if (!typedResult.ok) {
        return (
          <div className="tool-card tool-error">
            <div className="tool-name">
              <CalculatorIcon />
              calculate · error
            </div>
            <div>{typedResult.error}</div>
          </div>
        );
      }
      return (
        <div className="tool-card">
          <div className="tool-name">
            <CalculatorIcon />
            calculate
          </div>
          <div className="tool-value">
            {typedResult.expression} = {typedResult.value}
          </div>
        </div>
      );
    },
  },

  getCurrentTime: {
    type: "backend",
    render: ({ result, status }) => {
      const typedResult = result as GetCurrentTimeResult | undefined;
      if (status.type === "running" || !typedResult) {
        return (
          <div className="tool-card">
            <div className="tool-name">
              <ClockIcon />
              getCurrentTime
            </div>
            <div className="tool-spinner">Checking the clock…</div>
          </div>
        );
      }
      if (!typedResult.ok) {
        return (
          <div className="tool-card tool-error">
            <div className="tool-name">
              <ClockIcon />
              getCurrentTime · error
            </div>
            <div>{typedResult.error}</div>
          </div>
        );
      }
      return (
        <div className="tool-card">
          <div className="tool-name">
            <ClockIcon />
            getCurrentTime · {typedResult.timezone}
          </div>
          <div className="tool-value">{typedResult.formatted}</div>
        </div>
      );
    },
  },

  searchKnowledge: {
    type: "backend",
    render: ({ result, args, status }) => {
      const typedResult = result as SearchKnowledgeResult | undefined;
      const query =
        typedResult?.query ?? (args as { query?: string })?.query ?? "…";
      if (status.type === "running" || !typedResult) {
        return (
          <div className="tool-card">
            <div className="tool-name">
              <SearchIcon />
              searchKnowledge
            </div>
            <div className="tool-spinner">Searching for "{query}"…</div>
          </div>
        );
      }
      if (typedResult.hits.length === 0) {
        return (
          <div className="tool-card">
            <div className="tool-name">
              <SearchIcon />
              searchKnowledge · "{query}"
            </div>
            <div className="tool-spinner">
              {typedResult.message ?? "No matches."}
            </div>
          </div>
        );
      }
      return (
        <div className="tool-card">
          <div className="tool-name">
            <SearchIcon />
            searchKnowledge · "{query}" · {typedResult.hits.length} hit
            {typedResult.hits.length === 1 ? "" : "s"}
          </div>
          <ul className="tool-hits">
            {typedResult.hits.map((hit, i) => (
              <li key={i}>
                <span className="tool-hit-source">{hit.source}</span>
                <span className="tool-hit-score">{hit.score.toFixed(2)}</span>
                <div className="tool-hit-text">{hit.text}</div>
              </li>
            ))}
          </ul>
        </div>
      );
    },
  },
};
