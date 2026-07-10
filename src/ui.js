import { CRANFIELD_EVALUATION_PROFILE } from "./cranfield/evaluation-profile.js";
import { ARCHITECTURE_VERSION, DATASET_PROFILE } from "./cranfield/schema.js";

const DATASET_PROFILE_JSON = JSON.stringify(DATASET_PROFILE);
const EVALUATION_PROFILE_JSON = JSON.stringify(CRANFIELD_EVALUATION_PROFILE);

const PHASES = [
  {
    id: "phase-1",
    label: "Phase 1",
    title: "Cranfield Foundation",
    status: "Live",
    href: "/phases/cranfield",
    goal: "Production-shaped OpenSearch BM25 baseline with public search, explain, and evaluation evidence.",
    dataset: "Cranfield aeronautics",
    metrics: "MAP 0.2402 / nDCG@10 0.2995",
    referenceId: "cranfield"
  },
  {
    id: "phase-2",
    label: "Phase 2",
    title: "BEIR Transferability",
    status: "Planned",
    href: "/phases/beir",
    goal: "Check that improvements transfer beyond Cranfield before accepting them.",
    dataset: "BEIR-compatible benchmark",
    metrics: "Not started",
    referenceId: "beir"
  },
  {
    id: "phase-3",
    label: "Phase 3",
    title: "Retail Relevance",
    status: "Planned",
    href: "/phases/esci",
    goal: "Move from academic document search to product search with Amazon ESCI.",
    dataset: "Amazon ESCI",
    metrics: "Not started",
    referenceId: "esci"
  },
  {
    id: "phase-4",
    label: "Phase 4",
    title: "Behavioral Ranking",
    status: "Planned",
    href: "/phases/behavior",
    goal: "Introduce behavior signals only after earlier relevance gates justify the complexity.",
    dataset: "Future behavior data",
    metrics: "Not started",
    referenceId: "behavior"
  }
];

const DATASET_REFERENCES = {
  cranfield: {
    title: "Cranfield collection",
    source: "Glasgow Cranfield test collection",
    href: "https://ir.dcs.gla.ac.uk/resources/test_collections/cran/",
    summary: "Classic information retrieval collection with aeronautics documents, queries, and relevance judgments. Phase 1 indexes the 1,400-document collection."
  },
  beir: {
    title: "BEIR benchmark",
    source: "BEIR project",
    href: "https://github.com/beir-cellar/beir",
    summary: "Heterogeneous information retrieval benchmark for testing whether retrieval improvements transfer across tasks and datasets."
  },
  esci: {
    title: "Amazon ESCI Shopping Queries",
    source: "Amazon Science esci-data",
    href: "https://github.com/amazon-science/esci-data",
    summary: "Product-search benchmark with Exact, Substitute, Complement, and Irrelevant relevance labels for query-product pairs."
  },
  behavior: {
    title: "Behavior signals",
    source: "Dataset not selected",
    href: "",
    summary: "Future phase. No public behavior dataset is selected yet; this phase will document the source, privacy boundary, and evaluation protocol before implementation."
  }
};

const CRANFIELD_NAV = [
  { id: "overview", label: "Overview", href: "/phases/cranfield" },
  { id: "search", label: "Search", href: "/phases/cranfield/search" },
  { id: "data", label: "Data", href: "/phases/cranfield/data" },
  { id: "explain", label: "Explain", href: "/phases/cranfield/explain" },
  { id: "evaluation", label: "Evaluation", href: "/phases/cranfield/evaluation" }
];

function pageShell({ title, body, currentSection = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #18212f;
      --muted: #52616b;
      --paper: #fffdf8;
      --surface: #f4f6f1;
      --line: #d9ded7;
      --accent: #0f766e;
      --accent-strong: #0b5f59;
      --amber: #b45309;
      --blue: #285f99;
      --red: #b42318;
      --shadow: 0 14px 34px rgba(24, 33, 47, 0.1);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background:
        linear-gradient(135deg, rgba(15, 118, 110, 0.08), transparent 40%),
        linear-gradient(315deg, rgba(180, 83, 9, 0.08), transparent 48%),
        var(--surface);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }

    a {
      color: var(--accent-strong);
    }

    .app {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 22px 0 34px;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 0 18px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      text-decoration: none;
      color: var(--ink);
    }

    .mark {
      display: grid;
      width: 38px;
      height: 38px;
      place-items: center;
      border: 1px solid #0f766e;
      border-radius: 8px;
      background: #e7f2ee;
      color: var(--accent-strong);
      font-weight: 800;
    }

    h1 {
      margin: 0;
      font-size: 1.15rem;
      line-height: 1.2;
    }

    h2,
    h3 {
      margin: 0;
      line-height: 1.25;
    }

    p {
      margin: 0;
    }

    .version {
      margin: 3px 0 0;
      color: var(--muted);
      font-size: 0.88rem;
    }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 253, 248, 0.82);
      color: var(--muted);
      font-size: 0.88rem;
      white-space: nowrap;
      text-decoration: none;
    }

    .status-dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.13);
    }

    .intro {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 18px;
      align-items: end;
      margin: 4px 0 20px;
    }

    .intro h2 {
      font-size: 1.75rem;
    }

    .intro p {
      margin-top: 8px;
      color: var(--muted);
      max-width: 760px;
    }

    .phase-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    .phase-card,
    .result,
    .eval-example,
    .summary-item {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 253, 248, 0.96);
      box-shadow: var(--shadow);
    }

    .phase-card {
      display: grid;
      min-height: 238px;
      padding: 15px;
      text-decoration: none;
      color: var(--ink);
    }

    .phase-card:hover,
    .phase-card:focus-visible {
      border-color: rgba(15, 118, 110, 0.55);
      outline: none;
    }

    .phase-card h3 {
      margin-top: 8px;
      font-size: 1rem;
    }

    .phase-card p {
      margin-top: 8px;
      color: var(--muted);
      font-size: 0.9rem;
    }

    .phase-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 750;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 0 8px;
      border-radius: 999px;
      background: #e7f2ee;
      color: var(--accent-strong);
      font-size: 0.76rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .badge.planned {
      background: #eef3f8;
      color: var(--blue);
    }

    .phase-footer {
      align-self: end;
      margin-top: 18px;
      color: var(--muted);
      font-size: 0.82rem;
    }

    .detail-layout {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }

    .phase-nav {
      display: grid;
      gap: 7px;
      position: sticky;
      top: 12px;
    }

    .phase-nav a {
      display: flex;
      align-items: center;
      min-height: 38px;
      padding: 0 11px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 253, 248, 0.9);
      color: var(--ink);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 720;
    }

    .phase-nav a.active,
    .phase-nav a:hover,
    .phase-nav a:focus-visible {
      border-color: var(--accent);
      background: #e7f2ee;
      color: var(--accent-strong);
      outline: none;
    }

    .content-band {
      display: grid;
      gap: 16px;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: end;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--line);
    }

    .section-head h2 {
      font-size: 1.38rem;
    }

    .section-head p {
      color: var(--muted);
      margin-top: 6px;
      max-width: 760px;
    }

    .quick-links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .button-link,
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 38px;
      padding: 0 12px;
      border: 1px solid var(--accent-strong);
      border-radius: 8px;
      background: var(--accent);
      color: #ffffff;
      font: inherit;
      font-size: 0.9rem;
      font-weight: 750;
      text-decoration: none;
      cursor: pointer;
    }

    .button-link.secondary {
      border-color: #c7d0cc;
      background: #ffffff;
      color: var(--ink);
    }

    button:disabled {
      border-color: #98aaa5;
      background: #98aaa5;
      cursor: wait;
    }

    .summary-grid,
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
    }

    .summary-item {
      min-height: 92px;
      padding: 12px;
    }

    .summary-item strong {
      display: block;
      color: var(--accent-strong);
      font-size: 1.1rem;
    }

    .summary-item span {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .tool-surface {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 253, 248, 0.96);
      box-shadow: var(--shadow);
      padding: 16px;
    }

    .search-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 104px 110px;
      gap: 10px;
      align-items: end;
    }

    label {
      display: block;
      margin: 0 0 7px;
      color: var(--muted);
      font-size: 0.86rem;
      font-weight: 700;
    }

    input,
    select {
      width: 100%;
      min-height: 44px;
      border: 1px solid #c7d0cc;
      border-radius: 8px;
      background: #ffffff;
      color: var(--ink);
      font: inherit;
    }

    input {
      padding: 0 13px;
    }

    select {
      padding: 0 10px;
    }

    .examples,
    .topic-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .examples {
      margin-top: 12px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 0 10px;
      border: 1px solid #c7d0cc;
      border-radius: 999px;
      background: #ffffff;
      color: var(--ink);
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
    }

    .result-meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 10px;
      min-height: 40px;
      margin: 16px 0 8px;
      color: var(--muted);
      font-size: 0.92rem;
    }

    .result-list,
    .example-grid,
    .data-list,
    .reference-grid,
    .flow-diagram {
      display: grid;
      gap: 10px;
    }

    .result,
    .eval-example {
      padding: 14px;
    }

    .result h3,
    .eval-example h3 {
      font-size: 1rem;
      margin-bottom: 8px;
    }

    .result p,
    .eval-query {
      color: #334155;
      font-size: 0.92rem;
    }

    .result-foot {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
      color: var(--muted);
      font-size: 0.82rem;
    }

    .empty-state {
      min-height: 180px;
      display: grid;
      place-items: center;
      border: 1px dashed #c7d0cc;
      border-radius: 8px;
      color: var(--muted);
      text-align: center;
      padding: 24px;
      background: rgba(255, 255, 255, 0.58);
    }

    .flow-diagram {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .flow-step {
      min-height: 132px;
      padding: 12px;
      border: 1px solid #dbe1dc;
      border-radius: 8px;
      background: #ffffff;
    }

    .flow-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      margin-bottom: 8px;
      border-radius: 999px;
      background: #e7f2ee;
      color: var(--accent-strong);
      font-size: 0.78rem;
      font-weight: 800;
    }

    .flow-step strong,
    .flow-step span:last-child {
      display: block;
    }

    .flow-step strong {
      color: var(--ink);
      font-size: 0.84rem;
      line-height: 1.25;
    }

    .flow-step span:last-child {
      margin-top: 5px;
      color: var(--muted);
      font-size: 0.78rem;
      line-height: 1.35;
    }

    .flow-diagram.stacked {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .flow-diagram.stacked .flow-step {
      min-height: 0;
      padding: 10px 12px;
    }

    .chip.active {
      background: var(--ink);
      border-color: var(--ink);
      color: #ffffff;
    }

    .milestone-compare {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      align-items: start;
    }

    .milestone-card {
      padding: 14px;
      border: 1px solid #dbe1dc;
      border-radius: 8px;
      background: #ffffff;
    }

    .milestone-card h4 {
      margin: 0 0 6px;
      font-size: 1rem;
    }

    .milestone-card h5 {
      margin: 12px 0 6px;
      font-size: 0.86rem;
    }

    .milestone-status {
      display: inline-flex;
      margin-bottom: 10px;
      padding: 3px 9px;
      border-radius: 999px;
      background: #e7f2ee;
      color: var(--accent-strong);
      font-size: 0.75rem;
      font-weight: 700;
    }

    .milestone-note {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 0.84rem;
      line-height: 1.4;
    }

    .milestone-results {
      margin: 0;
      padding-left: 20px;
      font-size: 0.9rem;
    }

    .milestone-results li {
      margin-bottom: 8px;
    }

    .rank-shift {
      color: var(--accent-strong);
      font-weight: 700;
    }

    .query-box {
      overflow: auto;
      max-height: 340px;
      margin-top: 12px;
      padding: 12px;
      border: 1px solid #dbe1dc;
      border-radius: 8px;
      background: #101827;
      color: #e5edf5;
      font: 0.78rem ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      line-height: 1.5;
      white-space: pre;
    }

    .data-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .data-row {
      padding: 13px;
      border-top: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.44);
    }

    .reference-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 12px;
    }

    .reference-item {
      padding: 13px;
      border: 1px solid #dbe1dc;
      border-radius: 8px;
      background: #ffffff;
    }

    .reference-item strong,
    .reference-item a {
      display: block;
    }

    .reference-item strong {
      font-size: 0.95rem;
    }

    .reference-item a {
      margin-top: 5px;
      font-size: 0.86rem;
      font-weight: 750;
      overflow-wrap: anywhere;
    }

    .reference-item p {
      margin-top: 7px;
      color: var(--muted);
      font-size: 0.84rem;
    }

    .data-row strong {
      display: block;
      margin-bottom: 4px;
    }

    .data-row span,
    .evaluation-note {
      color: var(--muted);
      font-size: 0.9rem;
    }

    .topic-list {
      padding: 0;
      margin: 0;
      list-style: none;
    }

    .topic-list li {
      padding: 5px 8px;
      border-radius: 999px;
      background: #eef3f8;
      color: var(--blue);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .metric-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .metric {
      min-height: 82px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #ffffff;
    }

    .metric strong {
      display: block;
      color: var(--accent-strong);
      font-size: 1.1rem;
    }

    .metric span {
      display: block;
      margin-top: 3px;
      color: var(--muted);
      font-size: 0.76rem;
      font-weight: 750;
    }

    .example-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .eval-type {
      display: inline-flex;
      margin-bottom: 8px;
      padding: 3px 8px;
      border-radius: 999px;
      background: #eef3f8;
      color: var(--blue);
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .eval-query {
      min-height: 84px;
      margin-bottom: 10px;
    }

    .eval-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      border-top: 1px solid #edf0ec;
      padding: 7px 0;
      color: var(--muted);
      font-size: 0.8rem;
    }

    .eval-row strong {
      color: var(--ink);
    }

    .judgment-list {
      display: grid;
      gap: 7px;
      margin-top: 8px;
    }

    .judgment {
      border-left: 3px solid #c7d0cc;
      padding-left: 8px;
      color: #334155;
      font-size: 0.8rem;
    }

    .judgment.good {
      border-left-color: var(--accent);
    }

    .judgment.bad {
      border-left-color: var(--amber);
    }

    .judgment strong {
      display: block;
      color: var(--ink);
      font-size: 0.8rem;
    }

    .missed {
      margin-top: 8px;
      color: var(--muted);
      font-size: 0.78rem;
    }

    @media (max-width: 1060px) {
      .phase-grid,
      .flow-diagram {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .summary-grid,
      .metric-grid,
      .example-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .app {
        width: min(100% - 20px, 1180px);
      }

      .topbar,
      .intro,
      .section-head {
        align-items: flex-start;
        flex-direction: column;
      }

      .intro,
      .detail-layout,
      .phase-grid,
      .summary-grid,
      .metric-grid,
      .example-grid,
      .data-list,
      .reference-grid,
      .flow-diagram,
      .search-form {
        grid-template-columns: 1fr;
      }

      .phase-nav {
        position: static;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  </style>
</head>
<body>
  <main class="app" data-section="${currentSection}">
    <header class="topbar">
      <a class="brand" href="/">
        <div class="mark" aria-hidden="true">RS</div>
        <div>
          <h1>Retail Search</h1>
          <p class="version">${ARCHITECTURE_VERSION}</p>
        </div>
      </a>
      <a class="status" href="/health" aria-label="Open health endpoint"><span class="status-dot" aria-hidden="true"></span>Live Cranfield baseline</a>
    </header>
    ${body}
  </main>
  ${clientScript(currentSection)}
</body>
</html>`;
}

export function renderHomePage() {
  const phaseCards = PHASES.map(
    (phase) => `<a class="phase-card" href="${phase.href}">
      <div>
        <div class="phase-meta"><span>${phase.label}</span><span class="badge ${phase.status === "Planned" ? "planned" : ""}">${phase.status}</span></div>
        <h3>${phase.title}</h3>
        <p>${phase.goal}</p>
      </div>
      <div class="phase-footer">
        <div>${phase.dataset}</div>
        <div>${phase.metrics}</div>
      </div>
    </a>`
  ).join("");

  return pageShell({
    title: "Retail Search",
    currentSection: "home",
    body: `<section class="intro">
      <div>
        <h2>Mission-driven search experiments</h2>
        <p>Each phase gets its own focused workspace. The home page stays small: status, purpose, metrics, and links to the phase details.</p>
      </div>
      <div class="quick-links">
        <a class="button-link" href="/phases/cranfield/search">Try Phase 1 Search</a>
        <a class="button-link secondary" href="/phases/cranfield/evaluation">View Evaluation</a>
      </div>
    </section>
    <section class="phase-grid" aria-label="Project phases">
      ${phaseCards}
    </section>
    ${renderDatasetReferences(PHASES.map((phase) => phase.referenceId))}`
  });
}

function phaseHeader(section) {
  const nav = CRANFIELD_NAV.map(
    (item) => `<a href="${item.href}" class="${item.id === section ? "active" : ""}">${item.label}</a>`
  ).join("");

  return `<aside class="phase-nav" aria-label="Phase 1 sections">${nav}</aside>`;
}

function sectionHead({ title, description, links = "" }) {
  return `<div class="section-head">
    <div>
      <h2>${title}</h2>
      <p>${description}</p>
    </div>
    ${links ? `<div class="quick-links">${links}</div>` : ""}
  </div>`;
}

function renderReferenceItem(reference) {
  const link = reference.href
    ? `<a href="${reference.href}" target="_blank" rel="noreferrer">${reference.source}</a>`
    : `<span>${reference.source}</span>`;
  return `<article class="reference-item">
    <strong>${reference.title}</strong>
    ${link}
    <p>${reference.summary}</p>
  </article>`;
}

function renderDatasetReferences(referenceIds, title = "Dataset references") {
  const references = referenceIds.map((id) => DATASET_REFERENCES[id]).filter(Boolean);
  return `<section class="tool-surface" aria-labelledby="dataset-references-title">
    <h3 id="dataset-references-title">${title}</h3>
    <div class="reference-grid">
      ${references.map(renderReferenceItem).join("")}
    </div>
  </section>`;
}

function renderOverviewSection() {
  return `<div class="content-band">
    ${sectionHead({
      title: "Phase 1 - Cranfield Foundation",
      description: "A production-shaped BM25 baseline over the Cranfield aeronautics collection. This phase proves the OpenSearch, Worker, explain, and evaluation path before adding more ranking complexity.",
      links: '<a class="button-link" href="/phases/cranfield/search">Search</a><a class="button-link secondary" href="/phases/cranfield/evaluation">Evaluation</a>'
    })}
    <div class="summary-grid">
      <div class="summary-item"><strong>1,400</strong><span>indexed documents</span></div>
      <div class="summary-item"><strong>225</strong><span>evaluation queries</span></div>
      <div class="summary-item"><strong>1,837</strong><span>relevance judgments</span></div>
      <div class="summary-item"><strong>0.2402</strong><span>MAP</span></div>
      <div class="summary-item"><strong>0.2995</strong><span>nDCG@10</span></div>
    </div>
    <div class="tool-surface">
      <h3>Phase 1 routes</h3>
      <div class="quick-links" style="margin-top:12px;">
        <a class="button-link secondary" href="/phases/cranfield/search">Search interface</a>
        <a class="button-link secondary" href="/phases/cranfield/data">Indexed data</a>
        <a class="button-link secondary" href="/phases/cranfield/explain">Explain flow</a>
        <a class="button-link secondary" href="/phases/cranfield/evaluation">Evaluation examples</a>
      </div>
    </div>
    ${renderDatasetReferences(["cranfield"], "Dataset reference")}
  </div>`;
}

function renderSearchSection() {
  return `<div class="content-band">
    ${sectionHead({
      title: "Search",
      description: "Try the live Cranfield BM25 baseline. Results come from the deployed Worker and the live cranfield-v0 OpenSearch index.",
      links: '<a class="button-link secondary" href="/phases/cranfield/explain">Explain Flow</a>'
    })}
    <section class="tool-surface">
      <h3>Architecture milestones</h3>
      <p class="evaluation-note" style="margin-top:8px;">Use these stable endpoints to compare the baseline, refined PRF, and the remote BGE candidate without changing the default Cranfield search.</p>
      <div class="quick-links" style="margin-top:12px;">
        <a class="button-link secondary" href="/api/milestones/arch-0.1/search?q=wing%20pressure%20distribution&size=2">ARCH-0.1 search</a>
        <a class="button-link secondary" href="/api/milestones/arch-0.1/explain?q=wing%20pressure%20distribution&size=2">ARCH-0.1 explain</a>
        <a class="button-link secondary" href="/api/milestones/arch-0.2-prf/search?q=wing%20pressure%20distribution&size=2">ARCH-0.2 PRF search</a>
        <a class="button-link secondary" href="/api/milestones/arch-0.2-prf/explain?q=wing%20pressure%20distribution&size=2">ARCH-0.2 PRF explain</a>
        <a class="button-link secondary" href="/api/milestones/arch-0.3-bge/search?q=wing%20pressure%20distribution&size=2">ARCH-0.3 search status</a>
        <a class="button-link secondary" href="/api/milestones/arch-0.3-bge/demo">ARCH-0.3 demo JSON</a>
      </div>
    </section>
    <section class="tool-surface" aria-labelledby="search-title">
      <h3 id="search-title">Search Cranfield</h3>
      <form id="search-form" class="search-form">
        <div>
          <label for="query">Query</label>
          <input id="query" name="q" autocomplete="off" placeholder="wing pressure distribution" required>
        </div>
        <div>
          <label for="size">Results</label>
          <select id="size" name="size">
            <option>5</option>
            <option selected>10</option>
            <option>20</option>
          </select>
        </div>
        <button id="search-button" type="submit">Search</button>
      </form>
      <div class="examples" id="examples" aria-label="Example searches"></div>
      <div class="result-meta" id="result-meta">
        <span>1,400 indexed Cranfield documents</span>
        <span>BM25 over title, abstract, and text</span>
      </div>
      <div id="results" class="result-list">
        <div class="empty-state">Search aerospace terms such as boundary layers, airfoils, pressure distribution, heat transfer, or wind tunnel measurements.</div>
      </div>
    </section>
    <section class="tool-surface">
      <h3>ARCH-0.3 demo samples</h3>
      <p class="evaluation-note" style="margin-top:8px;">These buttons replay archived GEN-023 BGE candidate samples so you can inspect a few query-level outcomes without pretending arbitrary live vector search is enabled yet.</p>
      <div class="quick-links" id="arch03-demo-controls" style="margin-top:12px;">
        <button class="chip" type="button" data-demo-sample="1">Sample 1</button>
        <button class="chip" type="button" data-demo-sample="3">Sample 3</button>
        <button class="chip" type="button" data-demo-sample="9">Sample 9</button>
        <button class="chip" type="button" data-demo-sample="all">Run all</button>
      </div>
      <div id="arch03-demo-output" class="example-grid" style="margin-top:12px;">
        <div class="empty-state">Choose a sample to load archived ARCH-0.3 BGE evidence.</div>
      </div>
    </section>
  </div>`;
}

function renderDataSection() {
  const fields = DATASET_PROFILE.indexedFields
    .map((field) => `<div class="data-row"><strong>${field.name} (${field.searchWeight})</strong><span>${field.role}</span></div>`)
    .join("");
  const topics = DATASET_PROFILE.topicHints.map((topic) => `<li>${topic}</li>`).join("");

  return `<div class="content-band">
    ${sectionHead({
      title: "Indexed Data",
      description: DATASET_PROFILE.description,
      links: '<a class="button-link secondary" href="/api/cranfield/meta">JSON</a>'
    })}
    <div class="summary-grid">
      <div class="summary-item"><strong>1,400</strong><span>documents</span></div>
      <div class="summary-item"><strong>225</strong><span>evaluation queries</span></div>
      <div class="summary-item"><strong>1,837</strong><span>qrels</span></div>
      <div class="summary-item"><strong>title</strong><span>3x boost</span></div>
      <div class="summary-item"><strong>abstract</strong><span>2x boost</span></div>
    </div>
    <section class="tool-surface">
      <h3>Searchable fields</h3>
      <div class="data-list" style="margin-top:12px;">${fields}</div>
    </section>
    <section class="tool-surface">
      <h3>Good topics to search</h3>
      <ul class="topic-list" style="margin-top:12px;">${topics}</ul>
    </section>
    ${renderDatasetReferences(["cranfield"], "Source reference")}
  </div>`;
}

function renderExplainSection() {
  return `<div class="content-band">
    ${sectionHead({
      title: "Explain",
      description: "This project evolves one search system through validated architecture milestones. Run the same query through each milestone and watch how the retrieval flow, ranking evidence, and results change as the architecture evolves.",
      links: '<a class="button-link secondary" href="/api/cranfield/explain?q=wing%20pressure%20distribution">JSON</a>'
    })}
    <section class="tool-surface">
      <h3>Run explain across architectures</h3>
      <p class="evaluation-note" style="margin-top:8px;">Compare all milestones side by side or focus on one. ARCH-0.1 ranks with plain BM25, ARCH-0.2 PRF reranks the same candidate pool with pseudo-relevance feedback, and ARCH-0.3 BGE reports its validated remote evidence because live vector runtime is not enabled yet.</p>
      <form id="explain-form" class="search-form" style="margin-top:12px;">
        <div>
          <label for="explain-query">Query</label>
          <input id="explain-query" name="q" autocomplete="off" placeholder="boundary layer transition" required>
        </div>
        <div>
          <label for="explain-size">Results</label>
          <select id="explain-size" name="size">
            <option>2</option>
            <option selected>5</option>
            <option>10</option>
          </select>
        </div>
        <button id="explain-button" type="submit">Explain</button>
      </form>
      <div class="quick-links" id="explain-milestones" style="margin-top:12px;" role="group" aria-label="Architecture milestone selection">
        <button class="chip active" type="button" data-explain-milestone="compare">Compare all</button>
        <button class="chip" type="button" data-explain-milestone="arch-0.1">ARCH-0.1 baseline</button>
        <button class="chip" type="button" data-explain-milestone="arch-0.2-prf">ARCH-0.2 PRF rerank</button>
        <button class="chip" type="button" data-explain-milestone="arch-0.3-bge">ARCH-0.3 BGE vector</button>
      </div>
      <div id="explain-output" style="margin-top:14px;">
        <div class="empty-state">Run explain to see how each architecture milestone processes the same query.</div>
      </div>
    </section>
    <section class="tool-surface">
      <h3>Milestone JSON endpoints</h3>
      <p class="evaluation-note" style="margin-top:8px;">The same comparison is available as raw JSON from the stable milestone endpoints.</p>
      <div class="quick-links" style="margin-top:12px;">
        <a class="button-link secondary" href="/api/milestones/arch-0.1/explain?q=wing%20pressure%20distribution&size=2">ARCH-0.1 explain</a>
        <a class="button-link secondary" href="/api/milestones/arch-0.2-prf/explain?q=wing%20pressure%20distribution&size=2">ARCH-0.2 PRF explain</a>
        <a class="button-link secondary" href="/api/milestones/arch-0.3-bge/explain?q=wing%20pressure%20distribution&size=2">ARCH-0.3 explain status</a>
      </div>
    </section>
  </div>`;
}

function renderEvaluationSection() {
  return `<div class="content-band">
    ${sectionHead({
      title: "Evaluation",
      description: "Live OpenSearch evaluation over 225 Cranfield queries at top-10. The examples show a strong case, a mixed case, and a failure case from the same run.",
      links: '<a class="button-link secondary" href="/api/cranfield/evaluation">JSON</a>'
    })}
    <div id="evaluation"></div>
  </div>`;
}

export function renderCranfieldPage(section = "overview") {
  const sections = {
    overview: renderOverviewSection,
    search: renderSearchSection,
    data: renderDataSection,
    explain: renderExplainSection,
    evaluation: renderEvaluationSection
  };
  const selected = sections[section] ? section : "overview";

  return pageShell({
    title: `Retail Search - Phase 1 ${selected}`,
    currentSection: selected,
    body: `<section class="detail-layout">
      ${phaseHeader(selected)}
      ${sections[selected]()}
    </section>`
  });
}

export function renderPlannedPhasePage(phaseId) {
  const phase = PHASES.find((item) => item.id === phaseId) || PHASES[1];
  return pageShell({
    title: `Retail Search - ${phase.title}`,
    currentSection: phaseId,
    body: `<section class="intro">
      <div>
        <h2>${phase.label} - ${phase.title}</h2>
        <p>${phase.goal}</p>
      </div>
      <a class="button-link secondary" href="/">All phases</a>
    </section>
    <div class="summary-grid">
      <div class="summary-item"><strong>${phase.status}</strong><span>status</span></div>
      <div class="summary-item"><strong>${phase.dataset}</strong><span>dataset</span></div>
      <div class="summary-item"><strong>${phase.metrics}</strong><span>metrics</span></div>
    </div>
    ${renderDatasetReferences([phase.referenceId], "Dataset reference")}`
  });
}

function clientScript(currentSection) {
  const includeEvaluation = currentSection === "evaluation";
  const includeSearchDemo = currentSection === "search";
  const evaluationJson = includeEvaluation ? EVALUATION_PROFILE_JSON : "null";
  const evaluationScript = includeEvaluation
    ? `
    function metric(value) {
      return Number(value).toFixed(4);
    }

    function renderEvaluation(profile) {
      const evaluation = document.querySelector("#evaluation");
      if (!evaluation) return;
      const examples = profile.examples.map((example) => (
        '<article class="eval-example">' +
          '<span class="eval-type">' + escapeHtml(example.type) + '</span>' +
          '<h3>' + escapeHtml(example.label) + '</h3>' +
          '<p class="eval-query">' + escapeHtml(example.query) + '</p>' +
          '<div class="eval-row"><span>nDCG@10</span><strong>' + metric(example.metrics.ndcgAt10) + '</strong></div>' +
          '<div class="eval-row"><span>Precision@10</span><strong>' + metric(example.metrics.precisionAt10) + '</strong></div>' +
          '<div class="eval-row"><span>Recall@10</span><strong>' + metric(example.metrics.recallAt10) + '</strong></div>' +
          '<div class="judgment-list">' +
            example.correctResults.slice(0, 2).map((item) => (
              '<div class="judgment good"><strong>Correct: rank ' + escapeHtml(item.rank) + ' / doc ' + escapeHtml(item.id) + ' / grade ' + escapeHtml(item.grade) + '</strong>' +
              escapeHtml(item.title) + '</div>'
            )).join("") +
            example.wrongOrWeakResults.slice(0, 2).map((item) => (
              '<div class="judgment bad"><strong>Wrong/weak: rank ' + escapeHtml(item.rank) + ' / doc ' + escapeHtml(item.id) + ' / grade ' + escapeHtml(item.grade) + '</strong>' +
              escapeHtml(item.title) + '<br>' + escapeHtml(item.reason) + '</div>'
            )).join("") +
          '</div>' +
          '<div class="missed">Missed relevant docs: ' + escapeHtml(example.missedRelevant.map((item) => item.id + ' (grade ' + item.grade + ')').join(', ') || 'none in top-10 window') + '</div>' +
        '</article>'
      )).join("");

      evaluation.innerHTML =
        '<div class="metric-grid">' +
          '<div class="metric"><strong>' + metric(profile.metrics.map) + '</strong><span>MAP</span></div>' +
          '<div class="metric"><strong>' + metric(profile.metrics.ndcgAt10) + '</strong><span>nDCG@10</span></div>' +
          '<div class="metric"><strong>' + metric(profile.metrics.precisionAt10) + '</strong><span>Precision@10</span></div>' +
          '<div class="metric"><strong>' + metric(profile.metrics.recallAt10) + '</strong><span>Recall@10</span></div>' +
          '<div class="metric"><strong>' + metric(profile.metrics.mrr) + '</strong><span>MRR</span></div>' +
        '</div>' +
        '<p class="evaluation-note" style="margin:12px 0 14px;">Live OpenSearch evaluation over ' + escapeHtml(profile.queryCount) + ' Cranfield queries at top-' + escapeHtml(profile.k) + '.</p>' +
        '<div class="example-grid">' + examples + '</div>';
    }`
    : "";
  const evaluationInit = includeEvaluation ? "renderEvaluation(EVALUATION_PROFILE);" : "";
  const searchDemoScript = includeSearchDemo
    ? `
    function renderArch03DemoCard(sample) {
      return (
        '<article class="eval-example">' +
          '<span class="eval-type">Archived ARCH-0.3 demo</span>' +
          '<h3>' + escapeHtml(sample.label) + '</h3>' +
          '<p class="eval-query">' + escapeHtml(sample.query) + '</p>' +
          '<div class="eval-row"><span>Query ID</span><strong>' + escapeHtml(sample.queryId) + '</strong></div>' +
          '<div class="eval-row"><span>nDCG@10</span><strong>' + Number(sample.metrics.ndcgAtK).toFixed(4) + '</strong></div>' +
          '<div class="eval-row"><span>Precision@10</span><strong>' + Number(sample.metrics.precisionAtK).toFixed(4) + '</strong></div>' +
          '<div class="eval-row"><span>Recall@10</span><strong>' + Number(sample.metrics.recallAtK).toFixed(4) + '</strong></div>' +
          '<div class="missed">Average precision: ' + Number(sample.metrics.averagePrecision).toFixed(4) + ' · Reciprocal rank: ' + Number(sample.metrics.reciprocalRank).toFixed(4) + '</div>' +
          '<p class="evaluation-note" style="margin-top:10px;">' + escapeHtml(sample.note) + '</p>' +
        '</article>'
      );
    }

    function initializeArch03Demo() {
      const controls = document.querySelector("#arch03-demo-controls");
      const output = document.querySelector("#arch03-demo-output");
      if (!controls || !output) return;

      async function runSample(sample) {
        output.innerHTML = '<div class="empty-state">Loading archived ARCH-0.3 demo sample ' + escapeHtml(sample) + '...</div>';
        try {
          const response = await fetch('/api/milestones/arch-0.3-bge/demo?' + new URLSearchParams({ sample }).toString());
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error?.message || "ARCH-0.3 demo failed");
          output.innerHTML =
            '<div class="query-box" style="margin:0 0 12px;">' +
              escapeHtml(payload.sourceArtifact) + '\\n' +
              'Generation ' + escapeHtml(payload.archivedValidation.generationId) + ' · ' +
              'Remote index ' + escapeHtml(payload.archivedValidation.index) + '\\n' +
              'This demo replays archived evidence; live runtime search remains disabled.' +
            '</div>' +
            payload.samples.map(renderArch03DemoCard).join("");
        } catch (error) {
          output.innerHTML = '<div class="empty-state">' + escapeHtml(error.message || "ARCH-0.3 demo failed") + '</div>';
        }
      }

      controls.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const sample = target.dataset.demoSample;
        if (!sample) return;
        runSample(sample);
      });
    }`
    : "";
  return `<script>
    const DATASET_PROFILE = ${DATASET_PROFILE_JSON};
    const EVALUATION_PROFILE = ${evaluationJson};
    const CURRENT_SECTION = document.querySelector(".app")?.dataset.section || "";

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\\"": "&quot;",
        "'": "&#39;"
      })[char]);
    }

    function renderFlow(flow, variant) {
      return '<ol class="flow-diagram' + (variant ? ' ' + variant : '') + '" aria-label="Search explain flow">' + flow.map((step, index) => (
        '<li class="flow-step">' +
          '<span class="flow-number">' + escapeHtml(index + 1) + '</span>' +
          '<strong>' + escapeHtml(step.title) + '</strong>' +
          '<span>' + escapeHtml(step.detail) + '</span>' +
        '</li>'
      )).join("") + '</ol>';
    }

    function setUrlQuery(query, size, milestone) {
      const url = new URL(window.location.href);
      url.searchParams.set("q", query);
      url.searchParams.set("size", size);
      if (milestone) {
        url.searchParams.set("milestone", milestone);
      }
      window.history.replaceState({}, "", url);
    }

    function renderResults(payload) {
      const resultMeta = document.querySelector("#result-meta");
      const results = document.querySelector("#results");
      if (!resultMeta || !results) return;

      resultMeta.innerHTML =
        '<span>' + escapeHtml(payload.totalHits) + ' matches in ' + escapeHtml(payload.index) + '</span>' +
        '<span>API ' + escapeHtml(payload.latency.apiMs) + ' ms / OpenSearch ' + escapeHtml(payload.latency.openSearchTookMs) + ' ms</span>';

      if (!payload.results.length) {
        results.innerHTML = '<div class="empty-state">No results matched that query.</div>';
        return;
      }

      results.innerHTML = payload.results.map((item) => (
        '<article class="result">' +
          '<h3>' + escapeHtml(item.title || item.id) + '</h3>' +
          '<p>' + escapeHtml(item.abstract || "No abstract text was returned for this result.") + '</p>' +
          '<div class="result-foot">' +
            '<span>ID ' + escapeHtml(item.id) + '</span>' +
            '<span>Score ' + escapeHtml(Number(item.score).toFixed(4)) + '</span>' +
            '<span>' + escapeHtml(item.source) + '</span>' +
          '</div>' +
        '</article>'
      )).join("");
    }

    ${evaluationScript}
    ${searchDemoScript}

    function initializeSearch() {
      const form = document.querySelector("#search-form");
      if (!form) return;
      const queryInput = document.querySelector("#query");
      const sizeInput = document.querySelector("#size");
      const searchButton = document.querySelector("#search-button");
      const examples = document.querySelector("#examples");

      DATASET_PROFILE.exampleQueries.forEach((query) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chip";
        button.textContent = query;
        button.addEventListener("click", () => {
          queryInput.value = query;
          runSearch(query, sizeInput.value);
        });
        examples.append(button);
      });

      async function runSearch(query, size) {
        const cleanQuery = query.trim();
        if (!cleanQuery) return;
        searchButton.disabled = true;
        searchButton.textContent = "Searching";
        setUrlQuery(cleanQuery, size);
        try {
          const response = await fetch('/api/search?' + new URLSearchParams({ q: cleanQuery, size }).toString());
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error?.message || "Search failed");
          renderResults(payload);
        } catch (error) {
          document.querySelector("#results").innerHTML = '<div class="empty-state">' + escapeHtml(error.message || "Search failed") + '</div>';
        } finally {
          searchButton.disabled = false;
          searchButton.textContent = "Search";
        }
      }

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        runSearch(queryInput.value, sizeInput.value);
      });

      const initial = new URLSearchParams(window.location.search);
      if (initial.has("q")) {
        queryInput.value = initial.get("q") || "";
        sizeInput.value = initial.get("size") || "10";
        runSearch(queryInput.value, sizeInput.value);
      }
    }

    function initializeExplain() {
      const form = document.querySelector("#explain-form");
      if (!form) return;
      const queryInput = document.querySelector("#explain-query");
      const sizeInput = document.querySelector("#explain-size");
      const button = document.querySelector("#explain-button");
      const output = document.querySelector("#explain-output");
      const milestoneControls = document.querySelector("#explain-milestones");
      const EXPLAIN_MILESTONES = ["arch-0.1", "arch-0.2-prf", "arch-0.3-bge"];
      let selectedMilestone = "compare";

      function milestoneSummaryFoot(summary) {
        if (!summary) return "";
        return '<div class="result-foot" style="margin:0 0 10px;">' +
          '<span>validated nDCG@10 ' + escapeHtml(Number(summary.ndcgAt10).toFixed(4)) + '</span>' +
          (summary.binaryNdcgAt20 ? '<span>binary nDCG@20 ' + escapeHtml(Number(summary.binaryNdcgAt20).toFixed(4)) + '</span>' : '') +
        '</div>';
      }

      function renderUnavailableCard(payload) {
        const m = payload.milestone;
        return '<article class="milestone-card">' +
          '<h4>' + escapeHtml(m.label) + '</h4>' +
          '<span class="milestone-status">' + escapeHtml(String(m.status).replace(/-/g, " ")) + '</span>' +
          milestoneSummaryFoot(m.resultSummary) +
          '<p class="milestone-note">' + escapeHtml(payload.error?.message || "Milestone runtime is not enabled.") + '</p>' +
          (m.remoteIndex ? '<p class="milestone-note">Its nDCG gains were validated against the remote index ' + escapeHtml(m.remoteIndex) + '. Replay the archived query-level evidence with the ARCH-0.3 demo on the <a href="/phases/cranfield/search">search page</a>.</p>' : '') +
          (payload.nextImplementationStep ? '<p class="milestone-note">Next step: ' + escapeHtml(payload.nextImplementationStep) + '</p>' : '') +
        '</article>';
      }

      function renderMilestoneCard(milestoneId, response, payload) {
        if (!payload) {
          return '<article class="milestone-card"><h4>' + escapeHtml(milestoneId) + '</h4><p class="milestone-note">Explain failed.</p></article>';
        }
        if (!response.ok) {
          if (payload.milestone) return renderUnavailableCard(payload);
          return '<article class="milestone-card"><h4>' + escapeHtml(milestoneId) + '</h4><p class="milestone-note">' + escapeHtml(payload.error?.message || "Explain failed") + '</p></article>';
        }
        const m = payload.milestone;
        const rerank = payload.reranking;
        const rerankNote = rerank
          ? '<p class="milestone-note">Rerank strategy: ' + escapeHtml(rerank.strategy) +
            (rerank.expansionTerms && rerank.expansionTerms.length ? '. Feedback terms discovered for this query: ' + escapeHtml(rerank.expansionTerms.join(", ")) + '.' : '.') + '</p>'
          : '<p class="milestone-note">No rerank stage: results are returned in BM25 order.</p>';
        const results = (payload.topResults || []).map((result) => {
          const moved = result.originalRank && result.originalRank !== result.rank;
          const score = result.rerankScore ?? result.score;
          return '<li>' + escapeHtml(result.title || result.id) +
            '<span class="result-foot"><span>score ' + escapeHtml(Number(score).toFixed(3)) + '</span>' +
            (moved ? '<span class="rank-shift">moved from #' + escapeHtml(result.originalRank) + ' by rerank</span>' : '') +
            '</span></li>';
        }).join("");
        return '<article class="milestone-card">' +
          '<h4>' + escapeHtml(m.label) + '</h4>' +
          '<span class="milestone-status">' + escapeHtml(String(m.status).replace(/-/g, " ")) + '</span>' +
          milestoneSummaryFoot(m.resultSummary) +
          renderFlow(payload.retrievalFlow, "stacked") +
          rerankNote +
          '<h5>Top results</h5>' +
          '<ol class="milestone-results">' + results + '</ol>' +
          '<details style="margin-top:10px;"><summary>Generated OpenSearch query</summary><div class="query-box">' + escapeHtml(JSON.stringify(payload.openSearch.query, null, 2)) + '</div></details>' +
        '</article>';
      }

      async function fetchMilestoneCard(milestoneId, query, size) {
        const response = await fetch('/api/milestones/' + milestoneId + '/explain?' + new URLSearchParams({ q: query, size }).toString());
        let payload = null;
        try {
          payload = await response.json();
        } catch (error) {
          payload = null;
        }
        return renderMilestoneCard(milestoneId, response, payload);
      }

      async function runExplain(query, size) {
        const cleanQuery = query.trim();
        if (!cleanQuery) return;
        button.disabled = true;
        button.textContent = "Explaining";
        setUrlQuery(cleanQuery, size, selectedMilestone);
        output.innerHTML = '<div class="empty-state">Running the query through ' + (selectedMilestone === "compare" ? "every architecture milestone" : selectedMilestone) + '...</div>';
        try {
          const ids = selectedMilestone === "compare" ? EXPLAIN_MILESTONES : [selectedMilestone];
          const cards = await Promise.all(ids.map((id) => fetchMilestoneCard(id, cleanQuery, size)));
          output.innerHTML = '<div class="milestone-compare">' + cards.join("") + '</div>';
        } catch (error) {
          output.innerHTML = '<div class="empty-state">' + escapeHtml(error.message || "Explain failed") + '</div>';
        } finally {
          button.disabled = false;
          button.textContent = "Explain";
        }
      }

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        runExplain(queryInput.value, sizeInput.value);
      });

      if (milestoneControls) {
        milestoneControls.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement) || !target.dataset.explainMilestone) return;
          selectedMilestone = target.dataset.explainMilestone;
          milestoneControls.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("active", chip === target));
          runExplain(queryInput.value, sizeInput.value);
        });
      }

      const initial = new URLSearchParams(window.location.search);
      queryInput.value = initial.get("q") || "wing pressure distribution";
      sizeInput.value = initial.get("size") || "5";
      const initialMilestone = initial.get("milestone");
      if (initialMilestone && (initialMilestone === "compare" || EXPLAIN_MILESTONES.includes(initialMilestone))) {
        selectedMilestone = initialMilestone;
        if (milestoneControls) {
          milestoneControls.querySelectorAll(".chip").forEach((chip) => {
            chip.classList.toggle("active", chip.dataset.explainMilestone === selectedMilestone);
          });
        }
      }
      if (CURRENT_SECTION === "explain") {
        runExplain(queryInput.value, sizeInput.value);
      }
    }

    initializeSearch();
    initializeExplain();
    ${includeSearchDemo ? "initializeArch03Demo();" : ""}
    ${evaluationInit}
  </script>`;
}
