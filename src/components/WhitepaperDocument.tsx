import Link from "next/link";

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

type Whitepaper = { title: string; version: string; date: string; updated: string; scope: string; conclusion: string; sections: { title: string; paragraphs: string[]; tables: DataTable[]; subsections: { title: string; paragraphs: string[]; tables: DataTable[] }[] }[] };

export default function WhitepaperDocument({ document, language }: { document: Whitepaper; language: "en" | "zh" }) {
  const zh = language === "zh";
  return (
    <article lang={zh ? "zh-CN" : "en"} className="mx-auto max-w-4xl">
      <nav aria-label={zh ? "语言选择" : "Language selection"} className="mb-6 flex gap-3 text-sm">
        <Link href="/whitepaper" hrefLang="en" aria-current={!zh ? "page" : undefined} className={`rounded-full border px-4 py-2 ${!zh ? "bg-ink text-white" : "text-ink"}`}>English</Link>
        <Link href="/whitepaper/zh" hrefLang="zh-CN" aria-current={zh ? "page" : undefined} className={`rounded-full border px-4 py-2 ${zh ? "bg-ink text-white" : "text-ink"}`}>中文</Link>
      </nav>
      <header className="border-b border-border pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink">RepHear · {zh ? "版本" : "Version"} {document.version} · {document.date}</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{document.title}</h1>
        <p className="mt-3 text-xs text-subtle">{zh ? "更新于" : "Updated"} {document.updated} · {zh ? "公众版" : "Public edition"}</p>
        <p className="mt-5 text-sm leading-7 text-subtle sm:text-base">{document.scope}</p>
        <div className="mt-6 rounded-2xl bg-surface p-5">
          <h2 className="font-semibold text-ink">{zh ? "我们的信念" : "Our belief"}</h2>
          <p className="mt-2 text-sm leading-7 text-subtle">{document.conclusion}</p>
        </div>

      </header>
      <nav aria-label={zh ? "白皮书目录" : "Whitepaper contents"} className="my-8 rounded-2xl border border-border p-5 sm:p-6">
        <h2 className="font-semibold text-ink">{zh ? "目录" : "Contents"}</h2>
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
        <Link className="font-medium text-ink underline" href="/referrals">{zh ? "邀请中心与现行条款" : "Referral Hub and current Referrer Terms"}</Link>
        <Link className="font-medium text-ink underline" href="/community/governance">{zh ? "社区选举" : "Community elections"}</Link>
        <a className="font-medium text-ink underline" href="#section-9">{zh ? "邀请奖励" : "Invitation rewards"}</a>
      </div>
    </article>
  );
}
