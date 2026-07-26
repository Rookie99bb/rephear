import { getDmcaEmail } from "@/lib/dmca";

export const metadata = {
  title: "DMCA / Takedown Request — RepHear",
};

export default function DmcaPage() {
  const email = getDmcaEmail();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        DMCA &amp; Takedown Requests
      </h1>
      <p className="mt-2 text-sm text-subtle">
        RepHear is a community platform: people nominate and recognise
        others, and photos on Nominee profiles are supplied by the
        nominating user, not created or hosted by RepHear itself. If you
        believe a photo, or any other content on RepHear, infringes your
        copyright or another right of yours, we want to hear about it and
        will act quickly.
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-subtle">
        Fastest way to reach us
      </h2>
      <p className="mt-2 text-sm text-ink">
        Email{" "}
        <a href={`mailto:${email}`} className="font-medium underline">
          {email}
        </a>{" "}
        with the details below. We review takedown requests as a
        priority and aim to remove or disable access to material
        identified in a valid notice promptly — typically by hiding the
        affected profile or Ranking while we confirm details, the same
        tools our moderation team already uses for other policy
        violations.
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-subtle">
        What a copyright (DMCA) notice must include
      </h2>
      <p className="mt-2 text-sm text-subtle">
        To be a valid notice under the U.S. Digital Millennium Copyright
        Act (17 U.S.C. § 512(c)(3)), your email should include all of
        the following:
      </p>
      <ol className="mt-3 flex flex-col gap-2 text-sm text-ink">
        <li>1. Your physical or electronic signature (typing your full legal name is sufficient).</li>
        <li>2. Identification of the copyrighted work you claim is being infringed.</li>
        <li>
          3. Identification of the material you claim is infringing, and its
          location on RepHear (the profile URL, or the Ranking and
          Nominee name, is enough for us to find it).
        </li>
        <li>4. Your contact information: name, mailing address, phone number, and email.</li>
        <li>
          5. A statement that you have a good-faith belief the use is not
          authorised by the copyright owner, its agent, or the law.
        </li>
        <li>
          6. A statement, made under penalty of perjury, that the above
          information is accurate and that you are the copyright owner
          or authorised to act on the owner&apos;s behalf.
        </li>
      </ol>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-subtle">
        Counter-notification
      </h2>
      <p className="mt-2 text-sm text-subtle">
        If content you posted was removed and you believe that was a
        mistake or misidentification, you may send a counter-notice to
        the same address. A valid counter-notice needs your signature,
        identification of the removed material and where it appeared,
        a statement under penalty of perjury that you have a good-faith
        belief it was removed in error, your contact information, and a
        statement consenting to the jurisdiction of the federal court in
        your district (or, if outside the US, any district where
        RepHear may be found).
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-subtle">
        Not a copyright issue?
      </h2>
      <p className="mt-2 text-sm text-subtle">
        If someone was nominated without their knowledge and wants to
        formally take ownership of and manage their own Public Profile,
        that&apos;s handled by our{" "}
        <span className="text-ink">Claim a Profile</span> flow directly
        on the profile page. For anything else — privacy concerns,
        impersonation, or other content issues — the same email address
        above reaches our team.
      </p>
    </div>
  );
}
