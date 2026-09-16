'use client';

import { useState, useEffect } from 'react';
import Navbar from "@/app/components/navbar";
import Footer from '@/app/components/footer';
import BackToTop from "@/app/components/backtotop";
import PageTransition from '@/app/components/page-transitions';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import { ChevronDown, AlertCircle, Phone, Mail } from 'lucide-react';

// ==========================================
// TABS CONFIGURATION (PDF SECTIONS I TO XI)
// ==========================================
const TABS = [
  { id: 'reservation', label: 'I. RESERVATION & UNIT HOLDING' },
  { id: 'documentary', label: 'II. DOCUMENTARY REQUIREMENTS' },
  { id: 'updates', label: 'III. BUYER INFORMATION UPDATES' },
  { id: 'soa', label: 'IV. STATEMENT OF ACCOUNT (SOA)' },
  { id: 'receipts', label: 'V. OFFICIAL RECEIPTS & POSTING' },
  { id: 'account-status', label: 'VI. ACCOUNT STATUS & MONITORING' },
  { id: 'cancellation', label: 'VII. CANCELLATION & REFUND' },
  { id: 'payment-methods', label: 'VIII. PAYMENT METHODS' },
  { id: 'missed-payments', label: 'IX. MISSED OR DELAYED PAYMENTS' },
  { id: 'financing', label: 'X. FINANCING' },
  { id: 'transfer-rights', label: 'XI. TRANSFER OF RIGHTS & CONTACT' },
];

// ==========================================
// BUYER'S GUIDE FAQ DATA STRUCTURE (FROM PDF)
// ==========================================
const guideData = [
  {
    id: 'reservation',
    title: 'Reservation and Unit Holding',
    sections: [
      {
        step: '01',
        title: 'How do I reserve a unit?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>A unit may be reserved upon submission of the required reservation documents and payment of the applicable reservation fee, subject to unit availability and Company approval.</p>
          </div>
        )
      },
      {
        step: '02',
        title: 'Is the reservation fee refundable?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>The reservation fee is generally non-refundable. The specific terms governing the reservation fee shall be as set forth in the applicable reservation agreement, promotional terms (if any), and other signed transaction documents.</p>
          </div>
        )
      },
      {
        step: '03',
        title: 'When will I receive my Contract to Sell (CTS)?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>The preparation and release of the Contract to Sell (CTS) generally commence after the Welcome Letter has been sent. Under normal processing, the CTS is expected to be available within seven (7) working days, subject to document verification, completion of requirements, and other internal processing procedures.</p>
          </div>
        )
      }
    ]
  },
  {
    id: 'documentary',
    title: 'Documentary Requirements',
    sections: [
      {
        step: '04',
        title: 'What are the reservation requirements?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>The following are the standard reservation requirements. Requirements may vary depending on the buyer profile, transaction structure, payment arrangement, and applicable approvals:</p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600">
              <li>Completely accomplished Reservation Agreement, signed by the buyer(s)</li>
              <li>Clear copy of at least one (1) valid primary government-issued ID with three (3) specimen signatures, subject to original presentation for verification if required</li>
              <li>Verified and cleared payment of the applicable Reservation Fee</li>
              <li>Computation Sheet generated from the Company&apos;s official sales system, duly acknowledged and signed by the buyer(s)</li>
              <li>Written company approval for any duly authorized exception to standard terms or company policies, where applicable</li>
              <li>Complete Post-Dated Checks (PDCs), where applicable, covering the required down payment obligations</li>
              <li>Notarized/Consularized/Apostilled Special Power of Attorney (SPA), if transacting through an authorized attorney-in-fact (AIF)</li>
              <li>Complete and verified contact details of the buyer(s)</li>
              <li>Proof of Billing for the past 6 months based on the address provided in the Reservation Agreement.</li>
            </ul>
            <div className="bg-amber-50/70 border border-brand-gold/30 p-4 rounded-sm mt-4 text-xs md:text-sm text-brand-blue">
              <strong>Note:</strong> Additional documents may be required as part of the Company&apos;s compliance obligations, including but not limited to requirements under applicable laws such as the Anti-Money Laundering Act (AMLA) and its implementing rules.
            </div>
          </div>
        )
      },
      {
        step: '05',
        title: 'What are the requirements for non-individual buyers (e.g., corporations, partnerships, or other juridical entities)?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>In addition to the standard reservation requirements, the following documents may be required for Corporate or Business Buyers, including corporations, partnerships, sole proprietorships, and similar entities:</p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600">
              <li>Certified true copy of the applicable constitutive documents (e.g., Articles of Incorporation, Articles of Partnership, and/or By-Laws, as applicable)</li>
              <li>Copy of the latest General Information Sheet (GIS), where applicable</li>
              <li>Copy of the BIR Certificate of Registration (COR)</li>
              <li>Notarized Board Resolution, Partner Resolution, Secretary&apos;s Certificate, or equivalent authorization document, indicating the date and place of meeting, authority to purchase the property, and the designated authorized representative</li>
              <li>Clear copy of valid government-issued ID (bearing photo and signature) of the authorized representative and relevant signatories, including the corporate secretary where applicable, each with three (3) specimen signatures</li>
              <li>Such other documents as may be required for verification, processing, or compliance with applicable laws and company policies</li>
            </ul>
          </div>
        )
      },
      {
        step: '06',
        title: 'What happens if I fail to submit required documents on time?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Failure to submit the required documents may delay the processing of your purchase and financing application, or other rights and obligations under the applicable transaction documents and Company policies. Buyers are encouraged to comply within the prescribed period.</p>
          </div>
        )
      }
    ]
  },
  {
    id: 'updates',
    title: 'Buyer Information Updates',
    sections: [
      {
        step: '07',
        title: 'What should I do if my personal information changes?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Buyers are required to promptly notify the Company of any changes to their personal information (e.g., civil status, address, contact details) and submit the corresponding supporting documents for record updating, subject to applicable Company policies and procedures.</p>
          </div>
        )
      }
    ]
  },
  {
    id: 'soa',
    title: 'Statement of Account (SOA)',
    sections: [
      {
        step: '08',
        title: 'How can I obtain my Statement of Account?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Statements of Account may be requested through the Company&apos;s designated channels or Customer Service. The availability of the Statement of Account shall be subject to applicable Company procedures.</p>
          </div>
        )
      },
      {
        step: '09',
        title: 'What should I do if I notice discrepancies in my SOA?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>If you notice any discrepancies, please contact Customer Service immediately or reach out to the Credit and Collection Department for review, verification, and appropriate action.</p>
          </div>
        )
      }
    ]
  },
  {
    id: 'receipts',
    title: 'Official Receipts and Payment Posting',
    sections: [
      {
        step: '10',
        title: 'When will my payment be posted?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Payments are posted after payment verification and reconciliation. Processing timelines may vary depending on the payment channel used.</p>
          </div>
        )
      },
      {
        step: '11',
        title: 'Will I receive an Official Receipt or Sales Invoice or proof of payment?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Official Receipts or Sales Invoices will be issued in accordance with applicable tax regulations.</p>
          </div>
        )
      }
    ]
  },
  {
    id: 'account-status',
    title: 'Account Status and Monitoring',
    sections: [
      {
        step: '12',
        title: 'How can I check my account status?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Buyers may contact Customer Service through the Company&apos;s designated channels to inquire about payment history, outstanding balances, and through Customer Service or the Buyer Portal (if available).</p>
          </div>
        )
      }
    ]
  },
  {
    id: 'cancellation',
    title: 'Cancellation and Refund',
    sections: [
      {
        step: '13',
        title: 'What happens in the event of cancellation?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Any applicable rights, remedies, and refund entitlements shall be determined based on the specific circumstances of the account, the provisions of the Contract to Sell, other applicable signed transaction documents, and applicable laws including, where applicable, Republic Act No. 6552 (Maceda Law). Buyers are encouraged to review their contract and consult the Company for guidance specific to their account.</p>
          </div>
        )
      }
    ]
  },
  {
    id: 'payment-methods',
    title: 'Payment Methods',
    sections: [
      {
        step: '14',
        title: 'What payment channels are accepted?',
        content: (
          <div className="space-y-6 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Payments must be made only through the Company&apos;s designated and authorized payment channels, as communicated by the Company from time to time. Buyers are encouraged to transact only through official company payment instructions and should not remit payments through unauthorized persons or channels.</p>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-sm border border-slate-200">
                <h6 className="text-brand-blue font-bold text-sm mb-3 uppercase tracking-wide">Available Payment Channels:</h6>
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
                  <li>Over-the-counter Bills Payment via partner banks</li>
                  <li>Online banking Bills Payment</li>
                  <li>Auto-Debit Arrangement (ADA)</li>
                  <li>Telegraphic Transfer for bulk payment (ideal for clients abroad)</li>
                  <li>Dated checks</li>
                  <li>Post-dated Checks</li>
                  <li>Cash (allowed only for payments made directly to the company&apos;s authorized cashier)</li>
                  <li>QR Pay</li>
                </ul>
              </div>

              <div className="bg-white p-5 rounded-sm border border-slate-200">
                <h6 className="text-brand-blue font-bold text-sm mb-3 uppercase tracking-wide">Accredited Payment Partners:</h6>
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
                  <li>Paynamics (via Golden Topper website)</li>
                  <li>E-wallets (GCash and Maya)</li>
                  <li>Aqwire (ideal for remittances from overseas into the Philippines)</li>
                </ul>
              </div>
            </div>

            <p className="text-xs md:text-sm text-slate-500 italic">Buyers are encouraged to verify the applicable authorized channels with the Company prior to making any payment.</p>
          </div>
        )
      }
    ]
  },
  {
    id: 'missed-payments',
    title: 'Missed or Delayed Payments',
    sections: [
      {
        step: '15',
        title: 'What happens if I miss a payment?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Missed payments may result in consequences under the applicable transaction documents (reservation agreement, Contract to Sell, etc.) and Company policies, including the accrual of penalties. Buyers are encouraged to please coordinate with Customer Service as soon as possible to discuss your available options.</p>
          </div>
        )
      },
      {
        step: '16',
        title: 'What happens if I continuously fail to meet my payment obligations?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Continued non-payment may result in penalties, cancellation of the contract, or other consequences in accordance with the Contract to Sell, other related transaction documents, and applicable laws, including Republic Act No. 6552 (Maceda Law) where applicable.</p>
          </div>
        )
      }
    ]
  },
  {
    id: 'financing',
    title: 'Financing',
    sections: [
      {
        step: '17',
        title: 'What financing options may be available?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Buyers may explore financing options through banks or other financing institutions acceptable to the Company, subject to qualification, lender approval, and applicable Company requirements. The availability of specific financing channels is subject to change and should be confirmed with the Company.</p>
          </div>
        )
      },
      {
        step: '18',
        title: 'What happens if my bank loan is not approved?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>If a buyer&apos;s financing application is not approved, the buyer may coordinate with the Company to discuss available payment alternatives, if any, subject to Company approval and applicable policies.</p>
          </div>
        )
      },
      {
        step: '19',
        title: 'How much financing can I obtain?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>The amount of financing that may be granted is determined solely by the financing institution based on its credit evaluation, policies, and final approval. As a general reference, some financing institutions may offer financing equivalent to a portion of the Total Contract Price, but this is not guaranteed and will vary depending on the lender and the buyer&apos;s qualifications.</p>
          </div>
        )
      },
      {
        step: '20',
        title: 'When should I begin processing my financing?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Buyers are generally encouraged to coordinate with their financing application in accordance with the payment schedule and obligations set out in the Contract to Sell. Buyers are generally encouraged to begin this process sufficiently in advance or at least three months prior to the due date, to allow adequate time for lender processing and approval. Delayed application may result in consequences under the CTS.</p>
          </div>
        )
      },
      {
        step: '21',
        title: 'Are interest rates fixed?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Interest rates are set by the applicable bank or financing institution and are subject to change based on the institution&apos;s prevailing policies. The Company has no control over, and makes no representations regarding, the interest rates offered by third-party lenders.</p>
          </div>
        )
      }
    ]
  },
  {
    id: 'transfer-rights',
    title: 'Transfer of Rights and Customer Service',
    sections: [
      {
        step: '22',
        title: 'Can I request to transfer my rights over the unit?',
        content: (
          <div className="space-y-4 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>Requests for transfer of rights are subject to the provisions of the Contract to Sell, applicable Company policies and requirements, submission of required documents, payment of applicable fees, and Company approval. Submission of a request does not automatically result in approval. The Company reserves the right to evaluate and act on transfer requests in accordance with its policies and the terms of the applicable transaction documents.</p>
          </div>
        )
      },
      {
        step: '23',
        title: 'How do I contact Customer Service?',
        content: (
          <div className="space-y-6 text-slate-600 font-light leading-relaxed text-sm md:text-base">
            <p>For inquiries or concerns, please contact our Customer Care team:</p>
            <div className="grid sm:grid-cols-2 gap-4 bg-white p-6 rounded-sm border border-slate-200">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-brand-blue">
                  <Mail size={18} className="text-brand-gold shrink-0" />
                  <a href="mailto:customercare@goldentopper.com" className="font-semibold text-sm hover:underline hover:text-brand-gold transition-colors">
                    customercare@goldentopper.com
                  </a>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3 text-slate-700">
                  <Phone size={16} className="text-brand-gold shrink-0" />
                  <span><strong>Manila:</strong> 0917-309-0594</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Phone size={16} className="text-brand-gold shrink-0" />
                  <span><strong>Cebu:</strong> 0917-557-0610</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 italic">
              These FAQs are subject to revision without prior notice. For specific account inquiries, please contact the Company&apos;s Customer Service through official channels.
            </p>
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
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  // Automatically open the first question of the active topic
  useEffect(() => {
    const current = guideData.find(g => g.id === activeTab);
    if (current && current.sections.length > 0) {
      setOpenAccordion(current.sections[0].step);
    }
  }, [activeTab]);

  // Lenis smooth scroll setup
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

        {/* Cinematic Hero Area */}
        <section className="relative w-full h-[50vh] min-h-[400px] flex items-center justify-center overflow-hidden bg-[#0A1128]">
          <div className="absolute inset-0 z-0">
            <Image 
              src="/images/buyers-guide/buyers-guide.webp" 
              alt="Golden Topper Buyer's Guide" 
              fill 
              className="object-cover opacity-40 grayscale mix-blend-luminosity"
              priority
            />
            <div className="absolute inset-0 bg-[#142f72]/80"></div>
          </div>
          
          <div className="relative z-10 max-w-[90rem] mx-auto w-full px-6 md:px-12 flex flex-col items-center text-center mt-16">
            <div className="flex flex-wrap justify-center text-[0.65rem] sm:text-xs md:text-sm tracking-[0.3em] md:tracking-[0.4em] uppercase text-white/80 font-normal mb-4 md:mb-6 gap-4 items-center">
              Support &amp; Resources
            </div>
            
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-serif text-white leading-[1.1] md:leading-[1.15] tracking-tight mb-4 max-w-5xl drop-shadow-2xl shadow-black py-2">
              <motion.span 
                initial={{ backgroundPosition: "200% center" }}
                animate={{ backgroundPosition: "-200% center" }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                className="font-normal inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-[#fff2cd] to-brand-gold bg-[length:200%_auto] drop-shadow-[0_0_20px_rgba(197,160,113,0.4)] pr-4 pb-2 pt-1 overflow-visible"
              >
                Buyer&apos;s Guide: FAQs
              </motion.span>
            </h1>
            
            <p className="text-white/80 text-sm md:text-base font-normal leading-relaxed max-w-3xl mx-auto drop-shadow-md">
              Frequently asked questions, requirements, payment policies, and guidelines to assist you throughout your property journey.
            </p>
          </div>
        </section>

        {/* Content Area with Sticky Sidebar Layout */}
        <main className="flex-grow max-w-[90rem] mx-auto w-full px-6 md:px-12 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 relative z-20">
          
          {/* Desktop Sticky Table of Contents */}
          <aside className="hidden lg:block lg:col-span-4 relative">
            <div className="sticky top-32 bg-white p-6 rounded-sm shadow-[0_20px_40px_rgba(0,0,0,0.03)] border border-gray-100 max-h-[calc(100vh-160px)] overflow-y-auto">
              <h4 className="text-xs tracking-widest uppercase text-brand-gold font-bold mb-4">Select a Section</h4>
              <ul className="space-y-3 text-sm font-medium">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <li key={tab.id}>
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className={`text-left w-full transition-all duration-200 uppercase tracking-wider text-[11px] font-bold py-1.5 px-2 rounded-sm
                          ${isActive 
                            ? 'text-brand-blue bg-slate-100 border-l-2 border-brand-gold pl-3' 
                            : 'text-slate-500 hover:text-brand-blue hover:bg-slate-50'
                          }
                        `}
                      >
                        {tab.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* Mobile Tabs Dropdown/Scroller */}
          <div className="block lg:hidden col-span-1 border-b border-gray-200 pb-4 overflow-x-auto hide-scrollbar">
            <div className="flex gap-4 min-w-max px-2">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`pb-2 uppercase tracking-widest text-[11px] font-bold transition-colors border-b-2 whitespace-nowrap
                      ${isActive 
                        ? 'text-brand-blue border-brand-gold' 
                        : 'text-slate-400 border-transparent'
                      }
                    `}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content (Accordion) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* GENERAL DISCLAIMER BOX FROM PDF */}
            <div className="bg-amber-50/60 border-l-4 border-brand-gold p-6 rounded-r-sm text-xs md:text-sm text-slate-700 leading-relaxed space-y-2">
              <div className="flex items-center gap-2 text-brand-blue font-bold uppercase tracking-widest text-[10px]">
                <AlertCircle size={14} className="text-brand-gold" />
                General Disclaimer
              </div>
              <p>
                These FAQs are provided for general guidance only and do not constitute a binding representation, amendment, or modification of the Contract to Sell (CTS) or any other signed transaction document. They do not create contractual rights, obligations, or entitlements beyond what is expressly set forth in the applicable signed documents and governing law. In the event of any inconsistency between these FAQs and the CTS or other signed transaction documents, the CTS and other signed transaction documents shall prevail.
              </p>
            </div>

            {/* Questions Header */}
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-2xl md:text-3xl font-serif text-brand-blue">
                {activeData.title}
              </h2>
            </div>

            {/* Accordion Questions */}
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-4"
            >
              {activeData.sections.map((section) => {
                const isOpen = openAccordion === section.step;
                // Strips leading zero: "01" -> "1", "14" -> "14"
                const cleanNumber = parseInt(section.step, 10);
                
                return (
                  <div 
                    key={section.step} 
                    className={`border rounded-sm transition-all duration-300 overflow-hidden ${
                      isOpen ? 'border-brand-blue/20 bg-white shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <button 
                      onClick={() => setOpenAccordion(isOpen ? null : section.step)}
                      className={`w-full flex items-center justify-between p-5 md:px-6 transition-colors text-left outline-none ${
                        isOpen ? 'bg-slate-50/70 pb-3' : 'bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 pr-4">
                        <span className="text-brand-gold font-mono font-bold text-sm shrink-0">
                          Q{cleanNumber}
                        </span>
                        <h3 className={`text-base md:text-lg font-serif font-medium transition-colors leading-snug ${isOpen ? 'text-brand-blue' : 'text-slate-800'}`}>
                          {section.title}
                        </h3>
                      </div>
                      <ChevronDown size={18} className={`transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-brand-gold' : 'text-slate-400'}`} />
                    </button>
                    
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden bg-slate-50/70"
                        >
                          <div className="px-5 md:px-6 pb-6 pt-1">
                            <div className="w-full h-[1px] bg-slate-200/60 mb-3.5"></div>
                            {section.content}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </main>

        <Footer />
        <BackToTop />
      </div>
    </PageTransition>
  );
}