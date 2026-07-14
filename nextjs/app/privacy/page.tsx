import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — CommunityHQ',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          ← Back to CommunityHQ
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: July 14, 2026</p>

        <div className="space-y-8 text-sm leading-6 text-gray-700">
          <section>
            <p>
              CommunityHQ (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;the app&rdquo;) is a community
              management platform used by residents, board members, and property staff of a homeowners
              association (HOA) to manage announcements, maintenance issues, architectural requests,
              violations, payments, and community documents. This policy explains what information we
              collect through the CommunityHQ web and mobile apps, how it&rsquo;s used, and who can see it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Information We Collect</h2>
            <p className="mb-2">We collect information you provide directly when you use the app:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account information:</strong> first name, last name, email address, and a password (stored only as a salted cryptographic hash — we never store or transmit your password in plain text after registration).</li>
              <li><strong>Property information:</strong> for residents, your unit/property address as recorded by your HOA.</li>
              <li><strong>Financial records:</strong> dues charges and payment history, including payment amount, method, and confirmation number. We do not collect or store full payment card numbers.</li>
              <li><strong>Maintenance issues:</strong> descriptions, categories, locations, and comments you submit when reporting a maintenance issue, plus any staff notes and status updates.</li>
              <li><strong>Architectural requests:</strong> descriptions and details of proposed property modifications you submit for board review.</li>
              <li><strong>Violations and appeals:</strong> violation records associated with your account and any appeal you submit in response.</li>
              <li><strong>Community activity:</strong> which announcements you&rsquo;ve read and how you&rsquo;ve voted in community polls.</li>
              <li><strong>Authentication data:</strong> a session token used to keep you signed in, stored securely on your device (in the system Keychain/Keystore on mobile, or browser storage on web).</li>
              <li><strong>Push notification token:</strong> if you enable notifications in the mobile app, we store a device push token (issued by Apple/Google via Expo) linked to your account, used only to deliver the notifications described below. No notification content is stored by Apple/Google beyond standard platform delivery.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Information We Do Not Collect</h2>
            <p>
              CommunityHQ does not access your device&rsquo;s camera, photo library, location, or contacts,
              and does not use advertising identifiers, third-party analytics SDKs, or ad networks.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">How We Use Your Information</h2>
            <p>We use the information above to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Operate core app features — dashboards, issue tracking, payments, announcements, and community documents.</li>
              <li>Let your HOA&rsquo;s board members and staff review and respond to issues, architectural requests, and violations.</li>
              <li>Maintain accurate dues and payment records for your property.</li>
              <li>Keep an internal record of account and record changes (who changed what, and when) for accountability within your HOA.</li>
              <li>Send push notifications (mobile app only, if enabled) for events relevant to you — new announcements, comments on your issues, violation notices, and decisions on your architectural requests.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Who Can See Your Information</h2>
            <p>
              Access is role-based. Residents can see their own issues, payments, and violations. Board
              members and property administrators can see community-wide records relevant to their role
              (e.g., all open issues, all violations) in order to manage the community. Vendors (maintenance
              contractors) may see limited details of issues assigned to them. We do not sell your
              information or share it with third parties for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Data Retention</h2>
            <p>
              We retain your information for as long as your account is active or as needed to maintain
              your HOA&rsquo;s community and financial records. You can request deletion of your account by
              contacting your HOA administrator.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Security</h2>
            <p>
              Passwords are hashed with bcrypt before storage. Sessions are authenticated with signed
              tokens, and production traffic is encrypted in transit (HTTPS/TLS).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Children&rsquo;s Privacy</h2>
            <p>CommunityHQ is intended for adult residents, board members, and staff of a homeowners association, and is not directed at children under 13.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Changes to This Policy</h2>
            <p>
              We may update this policy as the app evolves. Material changes will be reflected by updating
              the &ldquo;Last updated&rdquo; date above.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Contact Us</h2>
            <p>
              Questions about this policy or your data can be directed to your HOA&rsquo;s administrator, or
              to <span className="font-mono">privacy@communityhq.example.com</span> (placeholder — replace with
              a real contact address before publishing).
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
