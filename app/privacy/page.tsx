import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — AI Study Assistant',
  description: 'How AI Study Assistant collects, uses, and shares your data.',
}

// Last updated: keep in sync with material changes to data handling.
const LAST_UPDATED = 'July 16, 2026'

// Sections 1, 8 and 9 route every GDPR access/erasure request here, and account
// deletion is request-only — this mailbox must stay monitored.
const CONTACT_EMAIL = 'studyassistant.privacy@gmail.com'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <article className="mx-auto w-full max-w-3xl space-y-8 text-foreground">
        <header className="space-y-2">
          <h1 className="text-4xl font-semibold">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </header>

        <section className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            This policy explains what personal data AI Study Assistant (&ldquo;we&rdquo;,
            &ldquo;the Service&rdquo;) collects, why, and who it is shared with. We
            collect only what is needed to run the Service and never sell your data.
          </p>
        </section>

        <Section title="1. Who is responsible">
          <p>
            The operator of AI Study Assistant is the data controller. For any
            privacy request, contact{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="2. What we collect">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Account data</strong> — email, optional
              display name, and a hashed password (or your Google account identifier if
              you sign in with Google). Managed by our authentication provider, Supabase.
            </li>
            <li>
              <strong className="text-foreground">Your study material</strong> — the
              documents, notes, text, images, and links (e.g. YouTube URLs) you upload,
              plus the parsed content and AI-generated artifacts we derive from them
              (summaries, quizzes, concept graphs, tags).
            </li>
            <li>
              <strong className="text-foreground">Usage &amp; progress data</strong> —
              quiz scores, the answers you write, and study progress, stored in our own
              database to power your analytics dashboard. This is first-party only; we
              run no third-party analytics or advertising trackers.
            </li>
            <li>
              <strong className="text-foreground">Feedback reports</strong> — if you send
              a bug report or idea through the in-app widget, we store your message along
              with the page you sent it from and your browser&rsquo;s user-agent string,
              so we can reproduce the problem.
            </li>
            <li>
              <strong className="text-foreground">Server logs</strong> — our hosting
              provider records standard request logs, which include your IP address. Our
              own application logs record identifiers such as your user ID, along with
              the titles, filenames and tags of material you upload. The contents of your
              documents are never written to logs.
            </li>
            <li>
              <strong className="text-foreground">Essential cookies</strong> — see
              section 5.
            </li>
          </ul>
        </Section>

        <Section title="3. Why we can process it (legal basis)">
          <p>
            We process your account data and study material to{' '}
            <strong className="text-foreground">perform our contract with you</strong> —
            i.e. to provide the Service you signed up for (Art. 6(1)(b) GDPR). Feedback
            reports and server logs are processed under our{' '}
            <strong className="text-foreground">legitimate interest</strong> in keeping
            the Service secure and working (Art. 6(1)(f) GDPR). If we ever want to use
            your data for anything beyond running the Service — such as training our own
            models or marketing — we will ask for your separate, explicit consent first.
          </p>
        </Section>

        <Section title="4. Who we share it with (sub-processors)">
          <p>
            To provide the Service we send data to the following processors. They act on
            our instructions and may store data in the United States, transferred under
            appropriate safeguards (e.g. Standard Contractual Clauses).
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Vercel</strong> — hosting. Serves the
              application and processes every request, including your IP address and
              user-agent, in its infrastructure logs.
            </li>
            <li>
              <strong className="text-foreground">Supabase</strong> — database, file
              storage, and authentication (hosts your account and material, and sends
              account emails such as password resets). Supabase also records sign-in IP
              addresses in its own audit log.
            </li>
            <li>
              <strong className="text-foreground">Google (Gemini API)</strong> — receives
              your material content to generate summaries, quizzes, and other study
              artifacts.
            </li>
            <li>
              <strong className="text-foreground">Groq</strong> — receives the same
              content as an AI processing fallback, and additionally receives{' '}
              <strong className="text-foreground">images you upload</strong> in order to
              extract text from them.
            </li>
          </ul>
          <p>
            Content sent to these AI providers is used to return a result to you and is
            subject to their respective terms; we do not authorize them to train on your
            content.
          </p>
          <p>
            When you add material by link, our servers fetch that URL — or, for a YouTube
            link, its transcript — from the internet on your behalf. The request comes
            from us, not from your browser, and carries no identifier of you. Be aware
            that the site at the other end will see a request from our servers.
          </p>
        </Section>

        <Section title="5. Cookies">
          <p>
            We use only <strong className="text-foreground">strictly necessary</strong>{' '}
            cookies to keep you signed in (<code className="text-sm">sb-access-token</code>{' '}
            and <code className="text-sm">sb-refresh-token</code>). These are required for
            the Service to function and are exempt from consent requirements, so we do not
            show a cookie banner. We also store your theme preference locally in your
            browser. We set no analytics, marketing, or tracking cookies.
          </p>
        </Section>

        <Section title="6. How we protect it">
          <p>
            Traffic to the Service is encrypted in transit with TLS, and your data is
            encrypted at rest by our infrastructure providers. Uploaded files live in a
            private storage bucket, partitioned per user, that is not reachable by public
            URL. Session cookies are <code className="text-sm">httpOnly</code>, so they
            cannot be read by scripts in your browser. Access to your material is scoped
            to your account, and only the operator can read incoming feedback reports.
          </p>
          <p>
            No service can promise perfect security, but we aim to hold only what the
            Service needs in order to work.
          </p>
        </Section>

        <Section title="7. How long we keep it">
          <p>
            We retain your account and material for as long as your account is active.
            When you delete a material, we remove the original file you uploaded, its
            parsed text, and everything derived from it — quizzes, questions, your
            answers, concept-graph links, and progress snapshots. This is immediate and
            cannot be undone.
          </p>
          <p>
            Until you delete it, material is kept indefinitely: we hold both the original
            file and the text extracted from it. To close your account entirely, email us
            (see section 8) and we will delete it together with all associated data.
            Backups and provider logs are purged on their normal cycles.
          </p>
        </Section>

        <Section title="8. Your rights">
          <p>
            Under the GDPR and similar laws you can request access to, correction of,
            export of, or deletion of your personal data, and object to or restrict its
            processing. To exercise any of these, email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>
            . You also have the right to lodge a complaint with your local data protection
            authority.
          </p>
        </Section>

        <Section title="9. Age requirement">
          <p>
            The Service is not intended for children. You must be at least 16 years old to
            create an account, or the minimum age at which you can consent to online
            services in your country, if that is higher. We do not knowingly collect data
            from children below that age; if you believe a child has given us their data,
            email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>{' '}
            and we will delete it.
          </p>
        </Section>

        <Section title="10. Changes to this policy">
          <p>
            We may update this policy as the Service evolves. Material changes will be
            reflected by the &ldquo;Last updated&rdquo; date above.
          </p>
        </Section>

        <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
          <a href="/auth/signup" className="text-primary hover:underline">
            ← Back to sign up
          </a>
        </footer>
      </article>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed">{children}</div>
    </section>
  )
}
