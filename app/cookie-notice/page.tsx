import type { Metadata } from 'next';
import Link from 'next/link';
import { CookieSettingsButton } from '@/app/components/cookie-consent';

export const metadata: Metadata = {
  title: 'Cookie Notice | Golden Topper',
  description: 'How Golden Topper uses cookies, browser storage, Cloudflare Turnstile security verification, and optional videos and maps.',
};

export default function CookieNoticePage() {
  return (
    <main className="min-h-screen bg-[#FDFBF7] px-6 py-16 text-gray-700">
      <div className="mx-auto max-w-5xl space-y-8">
        <Link href="/" className="text-sm text-brand-blue underline">Back to Golden Topper</Link>
        <header>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-blue">Privacy choices</p>
          <h1 className="text-4xl font-semibold text-brand-blue">Cookie Notice</h1>
          <p className="mt-4 leading-relaxed">Cookies are small pieces of information stored by your browser. We also use browser storage for certain admin features and Cloudflare Turnstile to protect payment submissions and admin login. Cookie preferences are separate from authentication and from the information you submit in a form.</p>
        </header>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-brand-blue">Cookies and browser storage we use</h2>
          <p className="text-sm text-gray-600 md:hidden">Scroll sideways to read the full table.</p>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full min-w-[880px] table-fixed text-left text-sm leading-6">
              <caption className="sr-only">Golden Topper cookie and browser storage inventory</caption>
              <colgroup><col className="w-[21%]" /><col className="w-[16%]" /><col className="w-[37%]" /><col className="w-[26%]" /></colgroup>
              <thead className="bg-slate-100 text-brand-blue"><tr><th scope="col" className="px-5 py-3">Name and type</th><th scope="col" className="px-5 py-3">Provider</th><th scope="col" className="px-5 py-3">Purpose</th><th scope="col" className="px-5 py-3">Duration</th></tr></thead>
              <tbody className="divide-y divide-gray-200">
                <tr><th scope="row" className="px-5 py-4 align-top font-semibold text-brand-blue">Cookie preferences<span className="mt-1 block text-xs font-normal text-gray-500">First-party cookie</span></th><td className="px-5 py-4 align-top">Golden Topper</td><td className="px-5 py-4 align-top">Remembers your necessary-only or optional-media choice and notice version. Contains no form data or login credentials.</td><td className="px-5 py-4 align-top">Browser session. Some browsers restore session cookies when reopening a previous session.</td></tr>
                <tr><th scope="row" className="px-5 py-4 align-top font-semibold text-brand-blue">Admin session<span className="mt-1 block text-xs font-normal text-gray-500">First-party cookie</span></th><td className="px-5 py-4 align-top">Golden Topper</td><td className="px-5 py-4 align-top">Authenticates administrators after successful login. Contains a signed admin identifier and expiry, not the password. Not created for ordinary form submissions.</td><td className="px-5 py-4 align-top">Up to 7 days. Removed on logout; the admin interface also signs out after one hour of inactivity.</td></tr>
                <tr><th scope="row" className="px-5 py-4 align-top font-semibold text-brand-blue">Bot protection<span className="mt-1 block text-xs font-normal text-gray-500">Third-party security cookie, where accepted</span></th><td className="px-5 py-4 align-top">Cloudflare, on Supabase-hosted services</td><td className="px-5 py-4 align-top">Responses from our Supabase services may request this cookie to help distinguish automated traffic from human visitors. Browser restrictions can prevent it from being stored. It is separate from Turnstile verification.</td><td className="px-5 py-4 align-top">30 minutes of inactivity, according to <a href="https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/" target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">Cloudflare&apos;s cookie documentation</a>.</td></tr>
                <tr><th scope="row" className="px-5 py-4 align-top font-semibold text-brand-blue">Admin activity<span className="mt-1 block text-xs font-normal text-gray-500">Local storage</span></th><td className="px-5 py-4 align-top">Golden Topper</td><td className="px-5 py-4 align-top">Records the last activity time for admin inactivity logout.</td><td className="px-5 py-4 align-top">Removed by the admin logout flow or browser data controls; local storage has no automatic expiry.</td></tr>
                <tr><th scope="row" className="px-5 py-4 align-top font-semibold text-brand-blue">News search<span className="mt-1 block text-xs font-normal text-gray-500">Session storage</span></th><td className="px-5 py-4 align-top">Golden Topper</td><td className="px-5 py-4 align-top">Remembers an administrator&apos;s news search.</td><td className="px-5 py-4 align-top">Browser tab session.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section id="security-verification" className="space-y-3">
          <h2 className="text-2xl font-semibold text-brand-blue">Security verification: Cloudflare Turnstile</h2>
          <p className="leading-relaxed">We use Cloudflare Turnstile, provided by Cloudflare, Inc., to help prevent automated abuse of payment submissions and admin login. It operates independently of the optional videos and maps choice. Blocking the security service may prevent verification and submission of those protected forms.</p>
          <p className="leading-relaxed">When the security service loads, Cloudflare receives technical signals such as your IP address, browser information, connection characteristics, and the website associated with the verification. Cloudflare describes how it uses these signals to provide and improve bot detection in its <a href="https://www.cloudflare.com/turnstile-privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">Turnstile Privacy Addendum</a>.</p>
          <p className="leading-relaxed">A successful check normally produces a verification token, which is separate from a cookie and is not an admin login session. The token can be used once and expires after five minutes. See <a href="https://developers.cloudflare.com/turnstile/get-started/server-side-validation/" target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">Cloudflare&apos;s token documentation</a>.</p>
          <p className="leading-relaxed">If Cloudflare pre-clearance is enabled, the service can also issue a <code className="break-all">cf_clearance</code> cookie to remember a successful security check. Its lifetime follows the configured Cloudflare security settings; it is not the five-minute token lifetime. Cookie issuance depends on the security configuration. See <a href="https://developers.cloudflare.com/cloudflare-challenges/concepts/clearance/" target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">Cloudflare&apos;s clearance documentation</a> and <a href="https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/" target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">cookie information</a>.</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-brand-blue">Optional third-party videos and maps</h2>
          <p className="leading-relaxed">YouTube videos, their thumbnails, and Google map tiles stay disabled until you allow optional media. Once enabled, these services receive connection information, such as your IP address, and may set or read their own cookies depending on their settings and your browser. Their cookies and retention periods are controlled by those providers.</p>
          <p className="leading-relaxed">Golden Topper does not enable optional analytics, advertising, or marketing scripts through this cookie choice. Choosing necessary cookies only does not prevent you from submitting payment, loan referral, inquiry, or contact forms.</p>
          <p className="leading-relaxed">You can turn optional media off in <CookieSettingsButton className="text-brand-blue" />. This stops further loading of the embedded media on this website. To delete cookies already set by third parties, use your browser&apos;s privacy controls.</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-brand-blue">Forms and your information</h2>
          <p className="leading-relaxed">Before a valid form is submitted, we show a notice explaining how the information is used. Closing or cancelling that notice sends no form data. Loan referrals have a separate authorization for disclosure to your selected bank. A cookie choice does not sign you up for promotional communications or create a customer account.</p>
          <p className="leading-relaxed">Read our <Link href="/privacy-policy" className="text-brand-blue underline">Privacy Policy</Link> for information about personal data.</p>
        </section>
        <div className="rounded-lg border border-brand-gold/40 bg-white p-6"><CookieSettingsButton className="font-semibold text-brand-blue" /></div>
      </div>
    </main>
  );
}
