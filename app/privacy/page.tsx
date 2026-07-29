// Public Privacy Policy — no login. Linked from the Intuit app + reachable by anyone.
export const dynamic = 'force-static'
export const metadata = { title: 'Privacy Policy · GateGuard' }

const UPDATED = 'July 2026'

export default function PrivacyPolicyPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#f7f8fb', color: '#1f2733', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 22px 80px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5a6b82' }}>Gate Guard, LLC</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '6px 0 4px' }}>Privacy Policy</h1>
        <div style={{ color: '#6b7889', fontSize: 14, marginBottom: 28 }}>Last updated: {UPDATED}</div>

        <Section title="Overview">
          Gate Guard, LLC (&ldquo;Gate Guard,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) provides access-control, video, and
          property-management software for security dealers and the properties they serve. This policy explains what
          information we collect, how we use it, and the choices you have. It applies to our web application at
          portal.gateguard.co and the customer portals we host for properties.
        </Section>

        <Section title="Information we collect">
          <ul style={ul}>
            <li><b>Account information</b> — name, email, phone, organization, and role, used to sign you in and set permissions.</li>
            <li><b>Property &amp; site data</b> — site names, addresses, devices, door/gate configuration, and contacts you enter.</li>
            <li><b>Access &amp; activity data</b> — door unlock events, gate activity, camera metadata, visitor passes, and service requests generated through the platform.</li>
            <li><b>Billing information</b> — invoices, balances, and payment status. Payments are processed by QuickBooks/Intuit; we do not store full card or bank details.</li>
            <li><b>Usage &amp; device data</b> — log data, IP address, and browser information used to operate and secure the service.</li>
          </ul>
        </Section>

        <Section title="How we use information">
          We use information to provide and secure the service, operate access control and video features, generate and
          collect invoices, provide support, and improve the product. We do not sell your personal information, and we do
          not display third-party advertising.
        </Section>

        <Section title="Service providers we share with">
          To deliver the service we share the minimum necessary data with vendors acting on our behalf, including:
          Brivo and Eagle Eye Networks (access control and video), UniFi and Shelly (network and relays),
          Intuit/QuickBooks (invoicing and payments), Clerk (authentication), Supabase and Vercel (hosting and data
          storage), and Resend (transactional email). Each processes data only to provide their service to us.
        </Section>

        <Section title="Data retention">
          We retain account and property data for as long as your organization uses the service, and as needed to meet
          legal, accounting, and security obligations. You may request deletion of data we control, subject to those
          obligations.
        </Section>

        <Section title="Security">
          We use encryption in transit, encrypted storage of third-party credentials, role-based access controls, and
          tenant isolation so one organization cannot access another&rsquo;s data. No system is perfectly secure, but we
          work to protect your information and to notify you of material incidents as required by law.
        </Section>

        <Section title="Your choices &amp; rights">
          Depending on your location, you may have rights to access, correct, or delete your personal information, or to
          object to certain processing. To exercise these rights, contact us at the address below.
        </Section>

        <Section title="Cookies">
          We use strictly necessary cookies to keep you signed in and to operate the portal. We do not use advertising or
          cross-site tracking cookies.
        </Section>

        <Section title="Children">
          The service is intended for business users and is not directed to children under 13, and we do not knowingly
          collect their information.
        </Section>

        <Section title="Changes">
          We may update this policy from time to time. Material changes will be posted here with a new &ldquo;last
          updated&rdquo; date.
        </Section>

        <Section title="Contact">
          Questions about this policy? Contact Gate Guard, LLC at <a href="mailto:rfeldman@gateguard.co" style={link}>rfeldman@gateguard.co</a>.
        </Section>
      </div>
    </main>
  )
}

const ul: React.CSSProperties = { margin: '4px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }
const link: React.CSSProperties = { color: '#2f6bd0', textDecoration: 'none' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.65, color: '#39465a' }}>{children}</div>
    </section>
  )
}
