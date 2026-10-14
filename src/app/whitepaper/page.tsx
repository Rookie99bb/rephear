import type { Metadata } from "next";
import Link from "next/link";
import document from "@/content/whitepaper.json";

export const metadata: Metadata = {
  title: "Product and Community Governance Whitepaper",
  description: "RepHear Whitepaper v1.2: Backer identity, community governance, and 5% direct invitation rewards for 180 days.",
  alternates: { canonical: "/whitepaper" },
};

type DataTable = { headers: string[]; rows: string[][] };

function Tables({ tables }: { tables: DataTable[] }) {
  return tables.map((table, index) => (
    <div key={index} className="my-5 overflow-x-auto rounded-xl border border-border" role="region" aria-label={`${table.headers[0]} comparison`} tabIndex={0}>
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="bg-surface text-ink">
          <tr>{table.headers.map((header) => <th key={header} scope="col" className="px-4 py-3 font-semibold">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => cellIndex === 0
            ? <th key={cellIndex} scope="row" className="px-4 py-3 align-top font-medium text-ink">{cell}</th>
            : <td key={cellIndex} className="px-4 py-3 align-top text-subtle">{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  ));
}

function Paragraphs({ paragraphs }: { paragraphs: string[] }) {
  return paragraphs.map((paragraph, index) => <p key={index} className="mt-3 text-sm leading-7 text-subtle sm:text-base">{paragraph}</p>);
}

export default function WhitepaperPage() {
  return (
    <article className="mx-auto max-w-4xl">
      <header className="border-b border-border pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink">RepHear · Version {document.version} · {document.date}</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{document.title}</h1>
        <p className="mt-3 text-xs text-subtle">Updated {document.updated} · Supersedes version 1.1</p>
        <p className="mt-5 text-sm leading-7 text-subtle sm:text-base">{document.scope}</p>
        <div className="mt-6 rounded-2xl bg-surface p-5">
          <h2 className="font-semibold text-ink">Core conclusion</h2>
          <p className="mt-2 text-sm leading-7 text-subtle">{document.conclusion}</p>
        </div>
        <details className="mt-5 rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">What changed in v1.2</summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-subtle">{document.changes.map((change) => <li key={change}>{change}</li>)}</ul>
        </details>
      </header>
      <nav aria-label="Whitepaper contents" className="my-8 rounded-2xl border border-border p-5 sm:p-6">
        <h2 className="font-semibold text-ink">Contents</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{document.sections.map((section, index) => <li key={section.title}><a className="text-subtle hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2" href={`#section-${index + 1}`}>{section.title}</a></li>)}</ul>
      </nav>
      <div className="space-y-10">{document.sections.map((section, index) => (
        <section key={section.title} id={`section-${index + 1}`} className="scroll-mt-24 border-t border-border pt-6">
          <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{section.title}</h2>
          <Paragraphs paragraphs={section.paragraphs} />
          <Tables tables={section.tables} />
          {section.subsections.map((subsection) => <section key={subsection.title} className="mt-6">
            <h3 className="text-base font-semibold text-ink sm:text-lg">{subsection.title}</h3>
            <Paragraphs paragraphs={subsection.paragraphs} />
            <Tables tables={subsection.tables} />
          </section>)}
        </section>
      ))}</div>
      <div className="mt-10 flex flex-wrap gap-5 border-t border-border pt-6 text-sm">
        <Link className="font-medium text-ink underline" href="/referrals">Referral Hub and current Referrer Terms</Link>
        <Link className="font-medium text-ink underline" href="/community/governance">Community elections</Link>
        <a className="font-medium text-ink underline" href="#section-10">Invitation programme</a>
      </div>
    </article>
  );
}
