'use client';

import { useState, useEffect } from 'react';
import Navbar from "@/app/components/navbar";
import Footer from '@/app/components/footer';
import BackToTop from "@/app/components/backtotop";
import PageTransition from '@/app/components/page-transitions';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import { ChevronDown, AlertCircle } from 'lucide-react';

// ==========================================
// TABS CONFIGURATION
// ==========================================
const TABS = [
  { id: 'unit-purchase', label: 'UNIT PURCHASE', disabled: false },
  { id: 'account-updates', label: 'ACCOUNT & PROJECT UPDATES', disabled: false },
  { id: 'financing-process', label: 'FINANCING PROCESS', disabled: true },
  { id: 'turnover-movein', label: 'TURN OVER & MOVE IN', disabled: true },
];

// ==========================================
// BUYER'S GUIDE DATA STRUCTURE
// ==========================================
const guideData = [
  {
    id: 'unit-purchase',
    sections: [
      {
        step: '01',
        title: 'Unit Selection',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>The journey to owning your dream home starts with selecting the right project and unit. Golden Topper offers a diverse portfolio of projects in various locations, each designed to suit different needs and lifestyles.</p>
            <p>Have a unit in mind already? You may book a visit to our project showrooms. Our accredited salespersons and Sales Officers shall assist you to confirm the availability of your preferred unit.</p>
            <p>The total contract price of the unit, your preferred payment terms, and the reservation requirements shall also be discussed.</p>
            <div className="bg-brand-gold/10 p-5 my-6 rounded-r-sm">
              <h5 className="text-brand-blue font-bold text-[10px] tracking-widest uppercase mb-2">Helpful Tip</h5>
              <p className="text-sm text-brand-blue">Visiting our project showroom allows you to experience the project location, and quality of our units firsthand, giving you a clearer vision of your future home. Want to consult with an accredited Golden Topper salesperson? Send us a message on Messenger!</p>
            </div>
          </div>
        )
      },
      {
        step: '02',
        title: 'Reservation Requirements',
        content: (
          <div className="space-y-6 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Once you've selected your project, the next step is securing your unit. This ensures your preferred unit is held for you while completing the documentary requirements and the settlement of the reservation fee.</p>
            
            <h5 className="text-brand-blue font-bold text-base mt-6">Document Requirements</h5>
            <div className="grid md:grid-cols-2 gap-6 mt-2">
              <div className="bg-white p-6 rounded-sm shadow-sm border border-brand-blue/10">
                <h6 className="text-brand-blue font-bold text-sm mb-4 tracking-wide">For Individual Buyers</h6>
                <ul className="list-disc pl-5 space-y-2 text-sm text-slate-500">
                  <li>Accomplished and Signed Reservation Agreement (RA)</li>
                  <li>1 Valid Government I.D. w/ 3 Specimen Signatures</li>
                  <li>Payment Schedule signed by the Buyer</li>
                </ul>
              </div>
              <div className="bg-white p-6 rounded-sm shadow-sm border border-brand-blue/10">
                <h6 className="text-brand-blue font-bold text-sm mb-4 tracking-wide">For Corporate Clients</h6>
                <ul className="list-disc pl-5 space-y-2 text-sm text-slate-500">
                  <li>Accomplished and Signed Reservation Agreement (RA)</li>
                  <li>1 Valid Government I.D. w/ 3 Specimen Signatures</li>
                  <li>Payment Schedule signed by the Buyer</li>
                  <li>Tax Identification Number of All Buyers</li>
                </ul>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-sm border border-slate-100 mt-6">
              <h5 className="text-brand-blue font-bold text-sm mb-3">Unit Reservation / Reservation Fee</h5>
              <p className="text-sm mb-4">After the Sales Officer confirms that the documentary requirements are complete, you may proceed to settle the reservation fee, which is non-transferable and non-refundable. The reservation fee may be paid in cash, bank transfer, or through our online payment gateway.</p>
              <p className="text-sm font-medium text-brand-blue">Please remember to always secure all Official Receipts issued and copies of your reservation documents.</p>
            </div>
          </div>
        )
      },
      {
        step: '03',
        title: 'Post-Reservation Requirements',
        content: (
          <div className="space-y-8 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>After you have successfully reserved your unit, you will be asked to accomplish requirements to facilitate the sales documentation process, which shall be in two phases: the Booking Phase, and the Contract to Sell Phase.</p>
            
            <div className="relative pl-6 border-l border-slate-200">
              <div className="absolute w-3 h-3 bg-brand-gold rounded-full -left-[6.5px] top-1.5 ring-4 ring-white"></div>
              <h5 className="text-brand-blue font-bold text-base mb-1">Booking Phase</h5>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-4">Due Twenty (20) Days from Reservation Date</p>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                <li>Accomplished and Signed Reservation Agreement (RA)</li>
                <li>For check payments: At least first twelve (12) post-dated checks</li>
                <li>For credit card payments: Fully accomplished and signed Auto Debit Account (ADA) form</li>
                <li>For cash payments: Payment must be cleared</li>
                <li>Contract to Sell (CTS) accomplished and signed by the Buyer</li>
                <li>Payment Schedule signed by the Buyer</li>
                <li>Taxpayer Identification Number (TIN) of all buyers</li>
              </ul>
            </div>

            <div className="relative pl-6 border-l border-slate-200">
              <div className="absolute w-3 h-3 bg-brand-blue rounded-full -left-[6.5px] top-1.5 ring-4 ring-white"></div>
              <h5 className="text-brand-blue font-bold text-base mb-1">Contract to Sell (CTS Phase)</h5>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-4">Due Thirty (30) Days from Reservation Date</p>
              <p className="text-sm mb-6">Shortly after unit reservation, our Sales Documentation and Control team shall send a cover letter and copies of the CTS for the Buyer's signature. The cover letter shall iterate that the signed CTS must be submitted within thirty (30) days.</p>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-6 rounded-sm shadow-sm border border-brand-blue/10">
                  <h6 className="text-brand-blue font-bold text-sm mb-3">For Individual Buyers</h6>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-slate-500">
                    <li>CTS signed by the Buyer</li>
                    <li>Proof of Mailing Address</li>
                    <li>If married: Copy of Marriage Contract</li>
                    <li>If annulled: Court Order of Finality</li>
                    <li>If children below 18 years old are included: Copy of Birth Certificate</li>
                    <li>If with Attorney-in-Fact: Notarized Special Power of Attorney & Clear copy of valid ID with three (3) specimen signatures</li>
                  </ul>
                </div>
                <div className="bg-white p-6 rounded-sm shadow-sm border border-brand-blue/10">
                  <h6 className="text-brand-blue font-bold text-sm mb-3">For Corporate Clients</h6>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-slate-500">
                    <li>CTS signed by the Buyer & Proof of Mailing Address</li>
                    <li>Certified true copy of SEC registration, By-Laws, Articles of Incorporation</li>
                    <li>Copy of Latest General Info Sheet (GIS) & BIR Certificate of Registration (COR)</li>
                    <li>Notarized Board Resolution & Secretary's Certificate</li>
                    <li>Valid ID with picture of the corporate secretary and the authorized representative with three (3) specimen signatures</li>
                  </ul>
                </div>
              </div>

              <p className="text-sm mb-4">If the Buyer fails to submit the signed CTS within thirty (30) days, it is presumed they have read the provisions and shall be construed for all legal intents and purposes as his/her acceptance and conformity of all the terms and conditions stipulated in the CTS.</p>
              <p className="text-sm">For Buyers living outside of the Philippines, consularized copies of CTS should be submitted within 90 days. Upon completion of CTS requirements, notarized copies of CTS shall be provided to the Buyer.</p>
            </div>

            <div className="bg-red-50/50 p-5 rounded-r-sm mt-6 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
              <div>
                <h5 className="text-red-700 font-bold text-[10px] tracking-widest uppercase mb-1">Important Reminder</h5>
                <p className="text-sm text-red-600/80">Please make sure to complete the requirements within the given time period. Otherwise, your unit reservation will be forfeited and cancelled.</p>
              </div>
            </div>
          </div>
        )
      },
      {
        step: '04',
        title: 'General Guidelines',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Documents from abroad must be consularized.</li>
              <li>Buyers may request for changes or amendments on their records/documents, subject for approval and fee if any.</li>
              <li>Buyers who are allowed to change mode of payments through Direct Deposit and Bank Fund Transfer must submit their proof of payments to the following:</li>
            </ul>
            <div className="grid sm:grid-cols-2 gap-4 mt-6 bg-slate-50 p-6 rounded-sm border border-slate-100 text-sm">
              <div><strong className="text-brand-blue font-semibold block mb-1">La Vida</strong><a href="mailto:lavidasales@goldentopper.com" className="text-brand-gold hover:underline transition-all">lavidasales@goldentopper.com</a></div>
              <div><strong className="text-brand-blue font-semibold block mb-1">City Clou</strong><a href="mailto:cityclousales@goldentopper.com" className="text-brand-gold hover:underline transition-all">cityclousales@goldentopper.com</a></div>
              <div><strong className="text-brand-blue font-semibold block mb-1">Park One</strong><a href="mailto:parkonesales@goldentopper.com" className="text-brand-gold hover:underline transition-all">parkonesales@goldentopper.com</a></div>
              <div><strong className="text-brand-blue font-semibold block mb-1">El Sol</strong><a href="mailto:elsolsales@goldentopper.com" className="text-brand-gold hover:underline transition-all">elsolsales@goldentopper.com</a></div>
            </div>
          </div>
        )
      }
    ]
  },
  {
    id: 'account-updates',
    sections: [
      {
        step: '01',
        title: 'Statement Of Account (SOA)',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Your Statement of Account (SOA) provides a detailed summary of your payments, outstanding balances, and due dates. Keeping track of this ensures you are always updated on the status of your account.</p>
            <p>Your Accounts Officer will issue SOAs periodically or upon request, ensuring that you're aware of your account's standing at all times.</p>
            <p className="mt-4">If you have any concerns regarding your SOA, you may reach out to our Customer Service through <a href="mailto:customercare@goldentopper.com" className="text-brand-gold font-semibold hover:underline transition-all">customercare@goldentopper.com</a>.</p>
            
            <div className="bg-slate-50 p-6 rounded-sm border border-brand-blue/10 mt-6">
              <p className="text-sm font-medium text-brand-blue mb-4 uppercase tracking-widest">Email Format Request:</p>
              <div className="text-sm font-mono text-slate-600 space-y-2 bg-white p-4 border border-brand-blue/10 rounded-sm">
                <p><strong className="text-brand-blue font-sans">Email Subject:</strong> Request for SOA and Billing Statement</p>
                <p><strong className="text-brand-blue font-sans">Buyers' Name:</strong> [Your Name]</p>
                <p><strong className="text-brand-blue font-sans">Project:</strong> [Project Name]</p>
                <p><strong className="text-brand-blue font-sans">Unit:</strong> [Unit Details]</p>
              </div>
            </div>
          </div>
        )
      },
      {
        step: '02',
        title: 'Missed Payments',
        content: (
          <div className="space-y-6 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Staying up to date with your payment schedule is crucial to maintaining your reservation and ensuring the smooth completion of your home purchase. In the event of a missed payment, we provide support to help you get back on track.</p>
            <p>To settle missed payments, you may reach out to our Customer Service through <a href="mailto:customercare@goldentopper.com" className="text-brand-gold font-bold hover:underline transition-all">customercare@goldentopper.com</a>.</p>

            <h5 className="text-brand-blue font-bold text-sm mt-10 mb-4 tracking-widest uppercase border-b border-slate-200 pb-2">What Happens When You Miss A Payment?</h5>
            <ul className="space-y-6 text-sm">
              <li className="flex gap-4">
                <div className="mt-1 w-2 h-2 rounded-full bg-brand-gold shrink-0"></div>
                <p><strong className="text-brand-blue font-semibold block mb-1">Initial Notification</strong> If a payment is missed, you will be promptly notified via email, SMS, or phone call. Our team will send a friendly reminder about the missed payment along with the amount due and the new payment deadline.</p>
              </li>
              <li className="flex gap-4">
                <div className="mt-1 w-2 h-2 rounded-full bg-brand-gold shrink-0"></div>
                <p><strong className="text-brand-blue font-semibold block mb-1">Late Payment Fees</strong> If the grace period lapses and the payment remains unsettled, late fees or penalties may apply. These penalties typically compound the longer the payment remains outstanding.</p>
              </li>
              <li className="flex gap-4">
                <div className="mt-1 w-2 h-2 rounded-full bg-brand-gold shrink-0"></div>
                <p><strong className="text-brand-blue font-semibold block mb-1">Payment Extensions</strong> If you anticipate difficulties in meeting an upcoming payment, you can reach out to our Customer Service team to request an extension. While extensions are granted on a case-by-case basis, early communication significantly increases the chances of approval.</p>
              </li>
              <li className="flex gap-4">
                <div className="mt-1 w-2 h-2 rounded-full bg-brand-gold shrink-0"></div>
                <p><strong className="text-brand-blue font-semibold block mb-1">Revised Payment Terms</strong> If financial difficulties are long-term, we may be able to help you by restructuring your payment terms. This could involve extending the duration of payment terms to reduce monthly payments or temporarily pausing payments until your financial situation stabilizes.</p>
              </li>
            </ul>

            <div className="bg-brand-gold/10 border-l-2 border-brand-gold p-5 mt-8 rounded-r-sm">
              <h5 className="text-brand-blue font-bold text-[10px] tracking-widest uppercase mb-2">Helpful Tip</h5>
              <p className="text-sm text-brand-blue">You can securely settle your monthly dues from anywhere, at any time, through our online payment gateway, helping you stay on track with your payments effortlessly.</p>
            </div>
          </div>
        )
      },
      {
        step: '03',
        title: 'Changes To Account',
        content: (
          <div className="space-y-6 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>In the case of changes to your account such as payment terms or personal information, we provide a streamlined process to accommodate these changes, ensuring that your account remains accurate and up-to-date.</p>
            <p>To process changes to your account, you may reach out to our Customer Service through <a href="mailto:customercare@goldentopper.com" className="text-brand-gold font-bold hover:underline transition-all">customercare@goldentopper.com</a>.</p>

            <ul className="space-y-6 text-sm mt-8">
              <li className="flex gap-4">
                <div className="mt-1 w-2 h-2 rounded-full bg-brand-blue shrink-0"></div>
                <p><strong className="text-brand-blue font-semibold block mb-1">Payment Terms</strong> If you need to adjust your payment terms —such as extending the payment schedule or shifting to a different financing option—our team will work with you to revise your terms in line with your financial situation.</p>
              </li>
              <li className="flex gap-4">
                <div className="mt-1 w-2 h-2 rounded-full bg-brand-blue shrink-0"></div>
                <p><strong className="text-brand-blue font-semibold block mb-1">Buyer's Information</strong> Should there be any updates to your personal details, such as changes in your contact information, marital status, or legal name, it's important to notify us promptly. This ensures that all future communications and documentation reflect your most current information.</p>
              </li>
              <li className="flex gap-4">
                <div className="mt-1 w-2 h-2 rounded-full bg-brand-blue shrink-0"></div>
                <p><strong className="text-brand-blue font-semibold block mb-1">Transfer of Information</strong> In certain cases, you may wish to transfer the unit's ownership to a family member or a third party. This requires the submission of formal documents and approvals to finalize the transfer.</p>
              </li>
              <li className="flex gap-4">
                <div className="mt-1 w-2 h-2 rounded-full bg-brand-blue shrink-0"></div>
                <p><strong className="text-brand-blue font-semibold block mb-1">Amendments of Financing Arrangements</strong> If you're switching from one financing option (e.g., in-house to bank financing) or changing your lender, notify us so we can assist with the necessary steps to update your payment and financing arrangements.</p>
              </li>
            </ul>
          </div>
        )
      },
      {
        step: '04',
        title: 'Project Updates',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Keeping you informed about the progress of your future home is a top priority. Throughout the development, we provide regular project updates to ensure that you are always aware of key milestones, expected timelines, and any potential adjustments.</p>
            <p>To request for the most recent project updates, you may reach out to our Customer Service through <a href="mailto:customercare@goldentopper.com" className="text-brand-gold font-bold hover:underline">customercare@goldentopper.com</a>.</p>
            
            <div className="bg-slate-50 p-6 rounded-sm border border-brand-blue/10 mt-6">
              <p className="text-sm font-medium text-brand-blue mb-4 uppercase tracking-widest">Email Format Request:</p>
              <div className="text-sm font-mono text-slate-600 space-y-2 bg-white p-4 border border-brand-blue/10 rounded-sm">
                <p><strong className="text-brand-blue font-sans">Email Subject:</strong> Request for Project Updates</p>
                <p><strong className="text-brand-blue font-sans">Buyers' Name:</strong> [Your Name]</p>
                <p><strong className="text-brand-blue font-sans">Project:</strong> [Project Name]</p>
                <p><strong className="text-brand-blue font-sans">Unit:</strong> [Unit Details]</p>
              </div>
            </div>
          </div>
        )
      },
      {
        step: '05',
        title: 'Cancellations',
        content: (
          <div className="space-y-6 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>We understand that unforeseen circumstances can arise, and sometimes buyers may need to cancel their home purchase. Our cancellation process is designed to be transparent, efficient, and supportive, ensuring that you are well-informed about your options and obligations.</p>
            <p>To process your request for cancellation, you may reach out to our Customer Service through <a href="mailto:customercare@goldentopper.com" className="text-brand-gold font-bold hover:underline transition-all">customercare@goldentopper.com</a>.</p>
            
            <ul className="space-y-6 text-sm mt-8">
              <li className="flex gap-4">
                <div className="mt-1 w-2 h-2 rounded-full bg-brand-blue shrink-0"></div>
                <p><strong className="text-brand-blue font-semibold block mb-1">Reservation Fee</strong> The reservation fee paid at the time of your unit reservation is generally non-refundable, as it secures the unit for you and prevents others from reserving it.</p>
              </li>
              <li className="flex gap-4">
                <div className="mt-1 w-2 h-2 rounded-full bg-brand-blue shrink-0"></div>
                <p><strong className="text-brand-blue font-semibold block mb-1">Other-Refundable Payments (Maceda Law)</strong> Refunds for monthly payments for cancelled units shall be processed in accordance with the Maceda Law. If you have paid at least two years of installments, the law entitles you to a refund equivalent to 50% of your total payments, with additional percentages applicable for longer payment terms. Whereas, if you have paid less than two years of installments, no refund shall be issued.</p>
              </li>
            </ul>

            <div className="bg-slate-50 border border-slate-200 p-8 mt-8 rounded-sm">
              <h5 className="text-brand-blue font-bold text-sm mb-6 tracking-widest uppercase">Alternatives to Cancellation</h5>
              <ul className="space-y-6 text-sm">
                <li className="flex gap-4">
                  <div className="mt-1 w-2 h-2 rounded-full bg-brand-gold shrink-0"></div>
                  <p><strong className="text-brand-blue font-semibold block mb-1">Revised Payment Plans</strong> If financial difficulties are the cause of the cancellation, consider reaching out to us about adjusting your payment plan. Extending payment terms or deferring payments can help ease financial pressures and keep your account on track.</p>
                </li>
                <li className="flex gap-4">
                  <div className="mt-1 w-2 h-2 rounded-full bg-brand-gold shrink-0"></div>
                  <p><strong className="text-brand-blue font-semibold block mb-1">Unit Transfer or Reassignment</strong> In some cases, we offer the option to transfer your reservation to another unit or reassign it to a family member or third party. This allows you to retain your investment in a way that suits your changing circumstances.</p>
                </li>
              </ul>
            </div>
          </div>
        )
      }
    ]
  }
];

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function BuyersGuideClient() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [openAccordion, setOpenAccordion] = useState<string | null>('01');

  // Automatically open the first accordion when switching tabs
  useEffect(() => {
    setOpenAccordion('01');
  }, [activeTab]);

  // --- Lenis Smooth Scroll Setup & Bulletproof Refresh ---
  useEffect(() => {
    window.history.scrollRestoration = 'manual';

    const lenis = new Lenis({
      duration: 1.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    setTimeout(() => {
      window.scrollTo(0, 0);
      lenis.scrollTo(0, { immediate: true });
    }, 50);

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  const activeData = guideData.find(g => g.id === activeTab) || guideData[0];

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#F9F9F7] font-sans flex flex-col selection:bg-brand-gold selection:text-white">
        <div className="relative z-50">
          <Navbar />
        </div>

        {/* Cinematic Hero Area - MAINTAINED FADING BACKGROUND */}
        <section className="relative w-full h-[50vh] min-h-[400px] flex items-center justify-center overflow-hidden bg-[#0A1128]">
          <div className="absolute inset-0 z-0">
            <Image 
              src="/images/buyers-guide/buyers-guide.webp" 
              alt="Golden Topper Buyer's Guide" 
              fill 
              className="object-cover opacity-40 grayscale mix-blend-luminosity"
              priority
            />
            {/* Adjusted Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0A1128]/95 via-brand-blue/80 to-[#F9F9F7]"></div>
          </div>
          
          <div className="relative z-10 max-w-[90rem] mx-auto w-full px-6 md:px-12 flex flex-col items-center text-center mt-16">
            
            {/* Eyebrow Text */}
            <div className="flex flex-wrap justify-center text-[0.65rem] sm:text-xs md:text-sm tracking-[0.3em] md:tracking-[0.4em] uppercase text-white/80 font-normal mb-4 md:mb-6 gap-4 items-center">
              Support & Resources
            </div>
            
            {/* Shining Text */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-serif text-white leading-[1.1] md:leading-[1.15] tracking-tight mb-4 max-w-5xl drop-shadow-2xl shadow-black py-2">
              <motion.span 
                initial={{ backgroundPosition: "200% center" }}
                animate={{ backgroundPosition: "-200% center" }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                className="font-normal inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-[#fff2cd] to-brand-gold bg-[length:200%_auto] drop-shadow-[0_0_20px_rgba(197,160,113,0.4)] pr-4 pb-2 pt-1 overflow-visible"
              >
                Buyer's Guide
              </motion.span>
            </h1>
            
            <p className="text-white/80 text-sm md:text-base font-normal leading-relaxed max-w-3xl mx-auto drop-shadow-md">
              Navigate the buying process with ease. Here are valuable insights and expert tips to help you make informed purchasing decisions.
            </p>

          </div>
        </section>

        {/* Content Area with Sticky Sidebar Layout */}
        <main className="flex-grow max-w-[90rem] mx-auto w-full px-6 md:px-12 py-20 lg:py-32 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 relative z-20">
          
          {/* Desktop Sticky Table of Contents */}
          <aside className="hidden lg:block lg:col-span-4 relative">
            <div className="sticky top-40 bg-white p-8 rounded-sm shadow-[0_20px_40px_rgba(0,0,0,0.03)] border border-gray-100">
              <h4 className="text-xs tracking-widest uppercase text-brand-gold font-bold mb-6">Select a Topic</h4>
              <ul className="space-y-4 text-sm font-medium text-gray-500">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const isDisabled = tab.disabled;

                  return (
                    <li key={tab.id}>
  <button
    disabled={isDisabled}
    onClick={() => !isDisabled && setActiveTab(tab.id)}
    className={`text-left w-full transition-all duration-300 uppercase tracking-widest text-[11px] font-bold flex items-center gap-2
      ${isActive 
        ? 'text-brand-blue' 
        : isDisabled
          ? 'text-slate-300 cursor-not-allowed'
          : 'text-slate-400 hover:text-brand-blue'
      }
    `}
  >
    {tab.label}
  </button>
</li>
                  )
                })}
              </ul>
            </div>
          </aside>

          {/* Mobile Tabs */}
          <div className="block lg:hidden col-span-1 border-b border-gray-200 pb-4 overflow-x-auto hide-scrollbar">
            <div className="flex gap-6 min-w-max px-2">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const isDisabled = tab.disabled;
                return (
                  <button
                    key={tab.id}
                    disabled={isDisabled}
                    onClick={() => !isDisabled && setActiveTab(tab.id)}
                    className={`pb-2 uppercase tracking-widest text-[11px] font-bold transition-colors border-b-2
                      ${isActive 
                        ? 'text-brand-blue border-brand-gold' 
                        : isDisabled
                          ? 'text-slate-300 border-transparent cursor-not-allowed'
                          : 'text-slate-400 border-transparent'
                      }
                    `}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Main Content (Accordion) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {activeData && (
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col gap-4"
              >
                {activeData.sections.map((section) => {
                  const isOpen = openAccordion === section.step;
                  
                  return (
                    <div 
                      key={section.step} 
                      className={`border rounded-sm transition-all duration-300 overflow-hidden ${
                        isOpen ? 'border-brand-blue/20 bg-white shadow-lg' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <button 
                        onClick={() => setOpenAccordion(isOpen ? null : section.step)}
                        className={`w-full flex items-center justify-between p-6 md:p-8 text-left outline-none transition-colors ${
                          isOpen ? 'bg-slate-50/50' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-5 md:gap-6">
                          <span className="text-brand-gold font-light text-xl md:text-2xl tracking-widest">
                            {section.step}.
                          </span>
                          <h3 className={`text-xl md:text-2xl font-serif transition-colors ${isOpen ? 'text-brand-blue' : 'text-slate-700'}`}>
                            {section.title}
                          </h3>
                        </div>
                        <ChevronDown size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand-gold' : 'text-slate-400'}`} />
                      </button>
                      
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="p-6 md:p-8 pt-0 bg-slate-50/50">
                              <div className="w-full h-[1px] bg-slate-100 mb-6"></div>
                              {section.content}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </motion.div>
            )}
          </div>
        </main>

        <Footer />
        <BackToTop />
      </div>
    </PageTransition>
  );
}