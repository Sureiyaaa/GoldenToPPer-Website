import type { Metadata } from 'next';
import Link from 'next/link';
import { CookieSettingsButton } from '@/app/components/cookie-consent';

export const metadata: Metadata = {
  title: 'Cookie Notice | Golden Topper',
  description: 'How Golden Topper uses cookies, browser storage, and optional videos and maps.',
};

export default function CookieNoticePage() {
  return (
    <main className="min-h-screen bg-[#FDFBF7] px-6 py-16 text-gray-700">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link href="/" className="text-sm text-brand-blue underline">Back to Golden Topper</Link>
        <header>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-blue">Privacy choices</p>
          <h1 className="text-4xl font-semibold text-brand-blue">Cookie Notice</h1>
          <p className="mt-4 leading-relaxed">Cookies are small pieces of information stored by your browser. We also use browser storage for certain admin features. Cookie preferences are separate from authentication and from the information you submit in a form.</p>
        </header>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-brand-blue">Cookies and browser storage we use</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Golden Topper cookie and browser storage inventory</caption>
              <thead className="bg-slate-100 text-brand-blue"><tr><th scope="col" className="p-4">Name / type</th><th scope="col" className="p-4">Purpose</th><th scope="col" className="p-4">Duration</th></tr></thead>
              <tbody className="divide-y divide-gray-200">
                <tr><th scope="row" className="break-all p-4 font-medium">gt_cookie_preferences<br /><span className="font-normal">First-party cookie</span></th><td className="p-4">Remembers your necessary-only or optional-media choice and notice version. Contains no form data or login credentials.</td><td className="p-4">Browser session. Some browsers restore session cookies when reopening a previous session.</td></tr>
                <tr><th scope="row" className="break-all p-4 font-medium">custom_admin_session<br /><span className="font-normal">First-party cookie</span></th><td className="p-4">Authenticates administrators after successful login. Contains a signed admin identifier and expiry, not the password. Not created for ordinary form submissions.</td><td className="p-4">Up to 7 days. Removed on logout; the admin interface also signs out after one hour of inactivity.</td></tr>
                <tr><th scope="row" className="break-all p-4 font-medium">last_admin_activity<br /><span className="font-normal">Local storage</span></th><td className="p-4">Records the last activity time for admin inactivity logout.</td><td className="p-4">Removed by the admin logout flow or browser data controls; local storage has no automatic expiry.</td></tr>
                <tr><th scope="row" className="break-all p-4 font-medium">admin-news-search<br /><span className="font-normal">Session storage</span></th><td className="p-4">Remembers an administrator&apos;s news search.</td><td className="p-4">Browser tab session.</td></tr>
              </tbody>
            </table>
          </div>
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
