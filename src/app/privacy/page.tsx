export const metadata = {
  title: "Privacy Policy — RepHear",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-subtle">
        Last updated: 29 September 2026
      </p>
      <p className="mt-4 text-sm text-ink">
        RepHear (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a community platform where
        people nominate, vote for and recognise others. This policy explains
        what personal data we collect, why, and what rights you have. By
        using rephear.com you agree to this policy.
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-subtle">
        What we collect
      </h2>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-ink">
        <li>
          <span className="font-medium">Account details.</span> Your email
          address and a securely hashed password. If you sign in with Google,
          we receive your name, email address and profile photo from Google —
          only after you approve it on Google&rsquo;s consent screen.
        </li>
        <li>
          <span className="font-medium">Things you do on RepHear.</span>{" "}
          Nominations, votes, supports, rankings you create, and referral or
          invite links you share.
        </li>
        <li>
          <span className="font-medium">Referral attribution.</span> When you
          arrive via someone&rsquo;s invite or campaign link, we store a cookie
          so we can credit them for your sign-up.
        </li>
        <li>
          <span className="font-medium">Fraud prevention signals.</span> To
          stop fake accounts and vote manipulation we record a device
          identifier, basic browser characteristics, and a one-way hash of
          your IP address. We never store your raw IP address.
        </li>
        <li>
          <span className="font-medium">Technical data.</span> Standard
          server logs (pages visited, timestamps) needed to run and secure
          the service.
        </li>
      </ul>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-subtle">
        How we use it
      </h2>
      <p className="mt-2 text-sm text-ink">
        We use your data to run RepHear: creating and securing your account,
        counting votes, attributing referrals, preventing abuse, and sending
        service emails (such as password resets and welcome messages). We do
        not sell your personal data, and we do not use it for third-party
        advertising.
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-subtle">
        Cookies
      </h2>
      <p className="mt-2 text-sm text-ink">
        We use cookies to keep you signed in, remember your preferences, and
        attribute referrals. You can block cookies in your browser, but parts
        of RepHear (such as staying logged in) will not work without them.
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-subtle">
        Third parties
      </h2>
      <p className="mt-2 text-sm text-ink">
        We share limited data only with the services we need to operate:
        Google (only when you choose Google sign-in), our hosting and
        database providers, and our email delivery provider. Each receives
        only what it needs to perform its function.
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-subtle">
        Your rights
      </h2>
      <p className="mt-2 text-sm text-ink">
        You can access, correct or delete your personal data at any time.
        Email{" "}
        <a href="mailto:hello@rephear.com" className="font-medium underline">
          hello@rephear.com
        </a>{" "}
        and we will respond to your request. Deleting your account removes
        your profile and personal data; anonymised aggregate statistics (such
        as vote totals) may remain.
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-subtle">
        Children
      </h2>
      <p className="mt-2 text-sm text-ink">
        RepHear is not directed at children under 13, and we do not knowingly
        collect their personal data. If you believe a child has provided us
        with personal data, contact us and we will delete it.
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-subtle">
        Changes to this policy
      </h2>
      <p className="mt-2 text-sm text-ink">
        We may update this policy as RepHear grows. Material changes will be
        noted here with a new &ldquo;last updated&rdquo; date.
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-subtle">
        Contact
      </h2>
      <p className="mt-2 text-sm text-ink">
        Questions about this policy:{" "}
        <a href="mailto:hello@rephear.com" className="font-medium underline">
          hello@rephear.com
        </a>
        .
      </p>
    </div>
  );
}
