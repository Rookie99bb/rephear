import Link from "next/link";
import { notFound } from "next/navigation";
import { findSocialEvent } from "@/db/events";

export default async function RoadToMcmTermsPage({ params }: { params: { slug: string } }) {
  const event = await findSocialEvent(params.slug);
  if (!event) notFound();

  return <main className="mx-auto max-w-3xl py-10">
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Promotional terms</p>
    <h1 className="mt-3 text-4xl font-black tracking-tight text-ink">Road to MCM Daily Draw</h1>
    <p className="mt-4 text-subtle">These terms apply to the RepHear free prize draws running from 17 to 25 October 2026.</p>

    <div className="mt-10 space-y-8 text-sm leading-7 text-ink">
      <Section title="1. Promoter">The promoter is RepHear. Questions may be sent to <a className="underline" href="mailto:hello@rephear.com">hello@rephear.com</a>.</Section>
      <Section title="2. Eligibility">Entry is free. A participant must have a RepHear account, create their own visible MCM Event Card, and have a current three-day check-in streak that includes the date of the relevant draw. Hidden, nominated-only, duplicate, fraudulent or automated accounts are not eligible. No purchase, Support Credits or paid action is required.</Section>
      <Section title="3. Draw schedule">One draw takes place each day from 17 to 25 October 2026 at 20:00 UK time. The eligible pool for each draw is determined from server records at the draw time. Closing dates and times will not be changed except where permitted by applicable promotional rules.</Section>
      <Section title="4. Entries and winners">Each eligible account receives one entry per daily draw. Longer streaks, purchases, Support, Votes and invitations do not create extra entries. One person may win no more than once across the campaign. Winners are selected using a verifiably random computer process and the result is recorded for audit.</Section>
      <Section title="5. Prize">Each daily winner may claim reimbursement of the actual price paid for one admission ticket purchased through the official MCM ticketing channel, up to a maximum of £50. Travel, accommodation, food, insurance, upgrades and other costs are excluded. There is no cash alternative beyond reimbursement of an eligible verified purchase.</Section>
      <Section title="6. Claiming reimbursement">A winner must respond within the period stated in the winner notice and provide an official purchase receipt plus the minimum information needed to verify the claim and make payment. The ticket must be used by the winner and may not be resold or transferred. If a winner is ineligible, cannot provide valid evidence or does not respond in time, RepHear may select a replacement from the same daily pool.</Section>
      <Section title="7. Fairness and safety">RepHear may reject entries affected by abuse, multiple-accounting, automation, manipulated check-ins or other material rule violations. Decisions will be based on recorded evidence. If circumstances outside RepHear’s reasonable control prevent an advertised award, RepHear will provide a reasonable equivalent where the law and event rules allow.</Section>
      <Section title="8. Privacy and publicity">Account, check-in, event participation and claim information is used to administer and audit the promotion. Winner information will only be published or made available as required by applicable promotional rules, with appropriate privacy protections. See the <Link className="underline" href="/privacy">Privacy Policy</Link>.</Section>
      <Section title="9. Independent promotion">This is an independent RepHear promotion. It is not affiliated with, sponsored by or endorsed by MCM Comic Con, ReedPop or the event organiser. Official ticket availability and admission remain subject to the organiser’s own terms.</Section>
    </div>

    <Link href={`/events/${event.slug}`} className="mt-10 inline-block font-bold text-violet-700 underline">← Back to the MCM community space</Link>
  </main>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="text-xl font-bold text-ink">{title}</h2><p className="mt-2 text-subtle">{children}</p></section>;
}
