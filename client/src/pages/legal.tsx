import { Shell } from "@/components/shell";

import { CONTACT_EMAIL } from "@/lib/contact";

const CONTACT = (
  <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary underline underline-offset-2 [overflow-wrap:anywhere]" data-testid="link-contact-email">{CONTACT_EMAIL}</a>
);

function Doc({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Shell>
      <article className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated: October 23, 2026</p>
        <div className="mt-6 space-y-4 text-base leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold">{children}</div>
      </article>
    </Shell>
  );
}

export function Privacy() {
  return (
    <Doc title="Privacy Policy">
      <p data-testid="text-privacy-summary">
        This app collects anonymous waitlist data to help parents and providers. We do not collect names or contact info.
        Data is stored securely and never sold. Contact: {CONTACT}.
      </p>
      <h2>What we collect</h2>
      <p>From parents: postal code, child's age group, an optional centre name, and how long you have been waiting. From searches: the first three characters of the postal code and the age group searched. From providers: a sign-in email address.</p>
      <h2>How we use it</h2>
      <p>To show estimated waitlist ranges to parents and aggregated demand signals to licensed providers. Providers never see individual parent identities because we never collect them.</p>
      <h2>Your choices</h2>
      <p>You can ask us to remove a submission at any time by contacting {CONTACT}. Anyone can report inaccurate or abusive content using the flag and report links in the app.</p>
      <h2>Changes</h2>
      <p>Placeholder: describe how users will be notified of changes to this policy.</p>
    </Doc>
  );
}

export function Terms() {
  return (
    <Doc title="Terms of Service">
      <p>Placeholder terms. Replace with terms reviewed by a qualified professional before publishing to the app stores.</p>
      <h2>Estimates only</h2>
      <p>Wait times are estimates based on anonymous parent reports. They are not official figures and may be inaccurate. Always confirm directly with a childcare centre.</p>
      <h2>Acceptable use</h2>
      <p>Do not submit false, abusive, or misleading information. We may remove any content that violates these terms.</p>
      <h2>Providers</h2>
      <p>Provider accounts are for licensed childcare operators. Vacancy status must be accurate and kept up to date.</p>
      <h2>Contact</h2>
      <p>Questions about these terms: {CONTACT}.</p>
    </Doc>
  );
}
