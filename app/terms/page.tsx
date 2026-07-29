// Public Terms of Service / EULA — no login. Linked from the Intuit app.
export const dynamic = 'force-static'
export const metadata = { title: 'Terms of Service · GateGuard' }

const UPDATED = 'July 2026'

export default function TermsPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#f7f8fb', color: '#1f2733', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 22px 80px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5a6b82' }}>Gate Guard, LLC</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '6px 0 4px' }}>Terms of Service &amp; End-User License Agreement</h1>
        <div style={{ color: '#6b7889', fontSize: 14, marginBottom: 28 }}>Last updated: {UPDATED}</div>

        <Section title="1. Acceptance">
          These Terms govern your access to and use of the software, websites, and services provided by Gate Guard, LLC
          (&ldquo;Gate Guard,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;), including portal.gateguard.co and the customer
          portals we host (the &ldquo;Service&rdquo;). By accessing or using the Service you agree to these Terms. If you
          are using the Service on behalf of an organization, you represent that you are authorized to bind it.
        </Section>

        <Section title="2. License">
          Subject to these Terms, Gate Guard grants you a limited, non-exclusive, non-transferable, revocable license to
          access and use the Service for your internal business or property-management purposes. We retain all rights not
          expressly granted.
        </Section>

        <Section title="3. Accounts &amp; access">
          You are responsible for the accuracy of your account information, for keeping credentials confidential, and for
          activity under your account. Access to doors, gates, cameras, and other systems is governed by the permissions
          set for your account; misuse of physical-control features is prohibited.
        </Section>

        <Section title="4. Acceptable use">
          You agree not to misuse the Service, including by attempting to access data belonging to other organizations,
          interfering with the Service&rsquo;s operation or security, reverse-engineering it except as permitted by law,
          or using it in violation of any applicable law or the rights of others.
        </Section>

        <Section title="5. Third-party services">
          The Service integrates with third-party systems you choose to connect, such as Brivo, Eagle Eye Networks,
          UniFi, Shelly, and Intuit/QuickBooks. Your use of those services is governed by their own terms, and Gate Guard
          is not responsible for their availability or actions.
        </Section>

        <Section title="6. Fees &amp; billing">
          Fees, where applicable, are set out in your order or agreement. Invoices and payments may be processed through
          QuickBooks/Intuit. Amounts are due per the terms of your invoice, and unpaid balances may result in suspension.
        </Section>

        <Section title="7. Intellectual property">
          The Service, including its software, design, and content, is owned by Gate Guard and its licensors and is
          protected by intellectual-property laws. You retain ownership of the data you submit; you grant us the rights
          needed to operate the Service for you.
        </Section>

        <Section title="8. Disclaimers">
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind to
          the fullest extent permitted by law. Gate Guard does not warrant that the Service will be uninterrupted or
          error-free, and it is not a substitute for professional security monitoring or emergency services.
        </Section>

        <Section title="9. Limitation of liability">
          To the fullest extent permitted by law, Gate Guard will not be liable for any indirect, incidental, special,
          consequential, or punitive damages, or for lost profits or data. Our aggregate liability arising out of or
          relating to the Service will not exceed the amounts you paid to us in the twelve months before the claim.
        </Section>

        <Section title="10. Termination">
          You may stop using the Service at any time. We may suspend or terminate access for violation of these Terms or
          to protect the Service. Provisions that by their nature should survive termination will survive.
        </Section>

        <Section title="11. Governing law">
          These Terms are governed by the laws of the State of Georgia, without regard to conflict-of-laws rules. The
          exclusive venue for disputes is the state and federal courts located in Fulton County, Georgia.
        </Section>

        <Section title="12. Changes">
          We may update these Terms from time to time. Continued use of the Service after changes take effect constitutes
          acceptance of the updated Terms.
        </Section>

        <Section title="13. Contact">
          Questions about these Terms? Contact Gate Guard, LLC at <a href="mailto:rfeldman@gateguard.co" style={link}>rfeldman@gateguard.co</a>.
        </Section>
      </div>
    </main>
  )
}

const link: React.CSSProperties = { color: '#2f6bd0', textDecoration: 'none' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.65, color: '#39465a' }}>{children}</div>
    </section>
  )
}
