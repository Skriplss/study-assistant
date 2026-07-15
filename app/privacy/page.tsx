import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — AI Study Assistant',
  description: 'How AI Study Assistant collects, uses, and shares your data.',
}

// Last updated: keep in sync with material changes to data handling.
const LAST_UPDATED = 'July 13, 2026'

// TODO: replace with your real operator details before going live.
const CONTACT_EMAIL = 'privacy@your-domain.example'

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
              documents, notes, text, and links (e.g. YouTube URLs) you upload, plus the
              parsed content and AI-generated artifacts we derive from them (summaries,
              quizzes, concept graphs, tags).
            </li>
            <li>
              <strong className="text-foreground">Usage &amp; progress data</strong> —
              quiz scores and study progress, stored in our own database to power your
              analytics dashboard. This is first-party only; we run no third-party
              analytics or advertising trackers.
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
            i.e. to provide the Service you signed up for (Art. 6(1)(b) GDPR). If we ever
            want to use your data for anything beyond running the Service — such as
            training our own models or marketing — we will ask for your separate, explicit
            consent first.
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
              <strong className="text-foreground">Supabase</strong> — database, storage,
              and authentication (hosts your account and material).
            </li>
            <li>
              <strong className="text-foreground">Google (Gemini API)</strong> — receives
              your material content to generate summaries, quizzes, and other study
              artifacts.
            </li>
            <li>
              <strong className="text-foreground">Groq</strong> — receives your material
              content as an AI processing fallback for the same purposes.
            </li>
          </ul>
          <p>
            Content sent to these AI providers is used to return a result to you and is
            subject to their respective terms; we do not authorize them to train on your
            content.
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

        <Section title="6. How long we keep it">
          <p>
            We retain your account and material for as long as your account is active.
            When you delete material, or your account, the associated data is removed from
            our database; backups and provider logs are purged on their normal cycles.
          </p>
        </Section>

        <Section title="7. Your rights">
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

        <Section title="8. Changes to this policy">
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
