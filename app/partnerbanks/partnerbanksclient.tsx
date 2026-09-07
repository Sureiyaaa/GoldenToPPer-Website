'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Navbar from '@/app/components/navbar';
import Footer from '@/app/components/footer';
import BackToTop from '@/app/components/backtotop';
import PageTransition from '@/app/components/page-transitions';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, AlertCircle } from 'lucide-react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createClient } from '@/lib/supabase/client'; 

// --- REGISTER GSAP ---
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// --- SCHEMAS AND INTERFACES ---
const loanSchema = z.object({
  condo: z.string().min(1, "Please select a project"),
  bank: z.string().min(1, "Please select a preferred bank"),
  tower: z.string().min(1, "Please select a tower"),
  unit: z.string().min(1, "Unit is required"),
  floor: z.string().min(1, "Floor number is required"),
  buyerName: z.string().min(2, "Please enter a valid full name"),
  coBuyerName: z.string().min(1, "Co-buyer name is required (or NA)"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().regex(/^(09|\+639)\d{9}$/, "Enter a valid PH mobile number"),
  isAgreed: z.boolean().refine((val) => val === true, {
    message: "You must agree to the Terms and Conditions",
  }),
});

type LoanFormData = z.infer<typeof loanSchema>;

interface Project { id: number; title: string; status: string; }
interface Bank { id: number; bank_name: string; max_loan: string; terms: string; short_description: string; image: string; }
interface ProjectBank { project_id: number; banks_id: number; }

interface PartnerBanksClientProps {
  initialProjects: Project[];
  initialBanks: Bank[];
  initialMappings: ProjectBank[];
}

// ==========================================
// INNER COMPONENT
// ==========================================
function PartnerBanksContent({ initialProjects, initialBanks, initialMappings }: PartnerBanksClientProps) {
  // Requires a client-side instance to submit form data securely
  const supabase = createClient();
  const searchParams = useSearchParams();
  const lenisRef = useRef<any>(null); 
  
  const [activeTab, setActiveTab] = useState("All Projects");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formTab, setFormTab] = useState("Pre-Application");

  const { register, handleSubmit, trigger, reset, formState: { errors, isSubmitting } } = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      condo: '', bank: '', tower: '', unit: '', floor: '',
      buyerName: '', coBuyerName: '', email: '', phone: '', isAgreed: false,
    }
  });

  // Handle URL Params for Modal Initialization
  useEffect(() => {
    if (searchParams.get('apply') === 'true') {
      const timer = setTimeout(() => {
        setIsModalOpen(true);
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Derived state generated directly from server props
  const filteredBanks = activeTab === "All Projects" 
    ? initialBanks 
    : initialBanks.filter((bank) => {
        const activeProj = initialProjects.find(p => p.title === activeTab);
        if (!activeProj) return false;
        return initialMappings.some(map => map.project_id === activeProj.id && map.banks_id === bank.id);
      });

  // --- FORM SUBMISSION ---
  const handleFormSubmit = async () => {
    const isValid = await trigger();
    if (!isValid) {
      setFormTab("Pre-Application"); 
      return;
    }
    handleSubmit(onSubmit)();
  };

  const onSubmit = async (data: LoanFormData) => {
    try {
      const nameParts = data.buyerName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'N/A';

      const { data: clientResult, error: clientErr } = await supabase
        .from('client')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: data.email,
          phone_number: data.phone
        })
        .select()
        .single();

      if (clientErr) throw clientErr;

      const { error: loanErr } = await supabase
        .from('loan_preapp')
        .insert({
          client_id: clientResult.id,
          project_id: parseInt(data.condo), 
          banks_id: parseInt(data.bank),  
          tower: data.tower,
          unit_no: parseInt(data.unit) || 0,
          floor_no: parseInt(data.floor) || 0,
          co_buyer_name: data.coBuyerName,
          is_agreed: data.isAgreed
        });

      if (loanErr) throw loanErr;

      alert("Application submitted successfully!");
      reset();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Submission Error:", err);
      alert(`Error submitting application: ${err.message}`);
    }
  };

  // --- INITIALIZE LENIS & SYNC WITH GSAP ---
  useEffect(() => {
    window.history.scrollRestoration = 'manual';

    const lenis = new Lenis({ 
      duration: 1.8, 
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false // Protects mobile performance
    });

    lenisRef.current = lenis;
    lenis.scrollTo(0, { immediate: true });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });

    // Instantly refresh GSAP layout calculations
    ScrollTrigger.refresh();

    return () => {
      lenis.destroy();
      gsap.ticker.remove((time) => lenis.raf(time * 1000));
    };
  }, []);

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#E7E7E7] font-sans relative" style={{ overflowAnchor: 'none' }}>
        <div className="absolute top-0 left-0 w-full z-50">
          <Navbar />
        </div>

        {/* HERO SECTION */}
        <section className="relative w-full h-screen min-h-[650px] flex flex-col justify-center z-10 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/banks-partner/partner-banks-cover.webp')" }}>
          <div className="absolute inset-0 bg-black/60 z-0"></div>
          <div className="max-w-[90rem] mx-auto w-full px-6 md:px-12 relative z-10 flex flex-col items-center text-center">
            <div className="flex flex-wrap justify-center text-[0.65rem] text-[12px] sm:text-xs md:text-[18px] tracking-[0.2em] md:tracking-[0.3em] uppercase text-white font-medium mb-6 md:mb-8 gap-4 items-center">
              Financial Partners
            </div>
             <h1 className="hero-text-update text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-serif font-normal text-white leading-[1.1] md:leading-[1.15] tracking-tight mb-8 md:mb-10 max-w-auto drop-shadow-2xl shadow-black py-2">
                <motion.span 
                  initial={{ backgroundPosition: "200% center" }}
                  animate={{ backgroundPosition: "-200% center" }}
                  transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                  className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-[#fff2cd] to-brand-gold bg-[length:200%_auto] drop-shadow-[0_0_20px_rgba(208,179,112,0.4)] px-4 py-2 overflow-visible"
                >
                Partner Banks
              </motion.span>
            </h1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/90 font-normal leading-relaxed max-w-3xl mx-auto drop-shadow-md mb-10 md:mb-12">
              Golden Topper is continuously expanding its network of partner banks to help support our clients in attaining their ideal home investment.
            </p>
            <button onClick={() => setIsModalOpen(true)} className="group relative flex items-center justify-center gap-6 w-full sm:w-auto bg-brand-blue px-8 py-4 overflow-hidden rounded-sm shadow-xl cursor-pointer outline-none">
              <span className="absolute inset-0 w-full h-full bg-brand-gold transform -translate-x-full transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0"></span>
              <span className="relative z-10 text-[11px] tracking-[0.25em] font-normal text-white uppercase text-xs md:text-sm">Apply for Bank Loan</span>
              <div className="relative z-10 w-5 h-5 flex items-center justify-center shrink-0">
                <ArrowRight size={16} className="text-white" />
              </div>
            </button>
          </div>
        </section>

        {/* MAIN CONTENT */}
        <main className="max-w-[90rem] mx-auto px-6 md:px-12 py-12 -mt-16 relative z-20">
          <div className="flex flex-wrap justify-center gap-3 mb-16 bg-white/80 backdrop-blur-md p-3 rounded-sm shadow-sm border border-slate-100 max-w-fit mx-auto">
            <button
              onClick={() => setActiveTab("All Projects")}
              className={`px-6 py-2.5 rounded-sm text-sm font-semibold transition-all duration-300 uppercase tracking-widest text-[12px] ${activeTab === "All Projects" ? "bg-brand-blue text-white shadow-md" : "bg-transparent text-slate-500 hover:text-brand-blue hover:bg-slate-100"}`}
            >
              All Projects
            </button>

            {initialProjects.map((project) => {
            const isUnavailable = project.status?.toLowerCase() === 'sold out';
              return (
                <button
                  key={project.id}
                  disabled={isUnavailable}
                  onClick={() => setActiveTab(project.title)}
                  className={`px-6 py-2.5 rounded-sm text-sm font-semibold transition-all duration-300 uppercase tracking-widest text-[12px] ${isUnavailable
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                      : activeTab === project.title
                        ? "bg-brand-blue text-white shadow-md"
                        : "bg-transparent text-slate-500 hover:text-brand-blue hover:bg-slate-100"
                    }`}
                >
                  {project.title}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredBanks.map((bank) => (
              <motion.div
                key={bank.id}
                whileHover={{ scale: 1.03, y: -5 }}
                className="bg-white rounded-sm p-8 shadow-sm hover:shadow-2xl transition-shadow duration-300 border border-slate-100 flex flex-col h-full cursor-pointer"
              >
                <div className="mb-8">
                  <div className="h-20 mb-6 flex items-center">
                    <img src={bank.image} alt={bank.bank_name} className="max-h-full max-w-[140px] object-contain" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 leading-tight min-h-[3.5rem] flex items-center">
                    {bank.bank_name}
                  </h3>
                </div>
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                    <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Max Loan</span>
                    <span className="text-2xl font-bold text-brand-blue">{bank.max_loan}%</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                    <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Terms</span>
                    <span className="text-lg font-semibold text-slate-700">{bank.terms}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed mt-auto bg-slate-50 p-4 rounded-sm">
                  {bank.short_description}
                </p>
              </motion.div>
            ))}
          </div>
        </main>

        <Footer />
        <BackToTop />

        {/* MODAL */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-3xl bg-white rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100">
                
                <div className="relative p-8 pb-6 text-center border-b border-slate-100 bg-white shrink-0">
                  <h2 className="text-3xl font-serif text-brand-blue tracking-tight">Application <span className="italic text-brand-gold">&</span> Requirements</h2>
                  <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-[#C5A071] transition-all p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div 
                  className="p-8 flex-1 overflow-y-auto bg-slate-50/30 custom-scrollbar overscroll-contain"
                  data-lenis-prevent="true"
                >
                  <div className="flex p-1 bg-slate-100/80 rounded-sm mb-8 max-w-md mx-auto">
                    <button onClick={() => setFormTab("Requirements")} className={`flex-1 py-2.5 text-[11px] tracking-widest uppercase font-bold rounded-sm transition-all ${formTab === "Requirements" ? "bg-white text-brand-blue shadow-sm" : "text-slate-400 hover:text-slate-800"}`}>Requirements</button>
                    <button onClick={() => setFormTab("Pre-Application")} className={`flex-1 py-2.5 text-[11px] tracking-widest uppercase font-bold rounded-sm transition-all ${formTab === "Pre-Application" ? "bg-white text-brand-blue shadow-sm" : "text-slate-400 hover:text-slate-800"}`}>Pre-Application</button>
                  </div>

                  {formTab === "Pre-Application" && (
                    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Project <span className="text-[#C5A071]">*</span></label>
                       <select {...register("condo")} className={`w-full bg-slate-50/50 border rounded-sm px-4 py-3 text-slate-800 focus:border-[#C5A071] outline-none ${errors.condo ? 'border-red-400' : 'border-slate-200'}`}>
                          <option value="" disabled>Select Project</option>
                        {initialProjects.map(p => (
                          <option key={p.id} value={p.id.toString()}>{p.title}</option>
                        ))}
                      </select>
                            {errors.condo && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.condo.message}</p>}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Bank <span className="text-[#C5A071]">*</span></label>
                          <select {...register("bank")} className={`w-full bg-slate-50/50 border rounded-sm px-4 py-3 text-slate-800 outline-none ${errors.bank ? 'border-red-400' : 'border-slate-200'}`}>
                            <option value="" disabled>Select Bank</option>
                            {initialBanks.map(b => (
                              <option key={b.id} value={b.id.toString()}>{b.bank_name}</option>
                            ))}
                          </select>
                          {errors.bank && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.bank.message}</p>}
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Tower <span className="text-[#C5A071]">*</span></label>
                          <select {...register("tower")} className={`w-full bg-slate-50/50 border rounded-sm px-4 py-3 text-slate-800 outline-none ${errors.tower ? 'border-red-400' : 'border-slate-200'}`}>
                            <option value="" disabled>Select Tower</option>
                            <option value="Tower A">Tower A</option>
                            <option value="Tower B">Tower B</option>
                            <option value="Tower C">Tower C</option>
                            <option value="Tower D">Tower D</option>
                          </select>
                          {errors.tower && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.tower.message}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Unit <span className="text-[#C5A071]">*</span></label>
                          <input type="number" {...register("unit")} className={`w-full bg-slate-50/50 border rounded-sm px-4 py-3 text-slate-800 outline-none ${errors.unit ? 'border-red-400' : 'border-slate-200'}`} />
                          {errors.unit && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.unit.message}</p>}
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Floor <span className="text-[#C5A071]">*</span></label>
                          <input type="number" {...register("floor")} className={`w-full bg-slate-50/50 border rounded-sm px-4 py-3 text-slate-800 outline-none ${errors.floor ? 'border-red-400' : 'border-slate-200'}`} />
                          {errors.floor && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.floor.message}</p>}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Primary Buyer Full Name <span className="text-[#C5A071]">*</span></label>
                        <input placeholder="e.g. Juan Dela Cruz" {...register("buyerName")} className={`w-full bg-slate-50/50 border rounded-sm px-4 py-3 text-slate-800 outline-none ${errors.buyerName ? 'border-red-400' : 'border-slate-200'}`} />
                        {errors.buyerName && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.buyerName.message}</p>}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Co-Buyer Full Name <span className="text-[#C5A071]">*</span></label>
                        <input placeholder="Type 'NA' if not applicable" {...register("coBuyerName")} className={`w-full bg-slate-50/50 border rounded-sm px-4 py-3 text-slate-800 outline-none ${errors.coBuyerName ? 'border-red-400' : 'border-slate-200'}`} />
                        {errors.coBuyerName && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.coBuyerName.message}</p>}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Email <span className="text-[#C5A071]">*</span></label>
                          <input type="email" {...register("email")} className={`w-full bg-slate-50/50 border rounded-sm px-4 py-3 text-slate-800 outline-none ${errors.email ? 'border-red-400' : 'border-slate-200'}`} />
                          {errors.email && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.email.message}</p>}
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Mobile Number <span className="text-[#C5A071]">*</span></label>
                          <input placeholder="09xxxxxxxxx" {...register("phone")} className={`w-full bg-slate-50/50 border rounded-sm px-4 py-3 text-slate-800 outline-none ${errors.phone ? 'border-red-400' : 'border-slate-200'}`} />
                          {errors.phone && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.phone.message}</p>}
                        </div>
                      </div>

                      <div className="pt-4">
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input type="checkbox" {...register("isAgreed")} className="mt-1 accent-brand-blue" />
                          <span className="text-xs text-slate-500 leading-relaxed group-hover:text-slate-700 transition-colors">
                            I agree to the <span className="text-brand-blue font-bold">Terms of Use</span> and <span className="text-brand-blue font-bold">Privacy Policy</span>
                          </span>
                        </label>
                        {errors.isAgreed && <p className="text-red-500 text-xs mt-2 flex items-center gap-1"><AlertCircle size={12} />{errors.isAgreed.message}</p>}
                      </div>
                    </form>
                  )}

                  {formTab === "Requirements" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      
                      <div className="bg-brand-gold/10 border border-brand-gold/30 p-4 rounded-sm flex items-start gap-4">
                        <p className="text-sm text-brand-blue leading-relaxed">
                          Kindly provide the necessary details in the Pre-Application tab and submit your physical/digital banking requirements to <span className="font-bold">gtloans@goldentopper.com</span>.
                        </p>
                      </div>

                      <div className="border border-slate-200 rounded-sm overflow-hidden bg-white shadow-sm">
                        <div className="max-h-[45vh] overflow-y-auto overflow-x-auto custom-scrollbar">
                          <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                              <tr>
                                <th className="py-3 px-4 uppercase text-[11px] font-bold text-slate-500 tracking-wider">Requirement</th>
                                <th className="py-3 px-4 uppercase text-[11px] font-bold text-slate-500 tracking-wider">Remarks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-600">
                              {[
                                { item: "Two (2) Valid Government IDs", remark: "Valid and unexpired" },
                                { item: "Marriage Contract", remark: "If married" },
                                { item: "Certificate of No Marriage (CENOMAR)", remark: "If single" },
                                { item: "Legal Separation / Annulment Papers", remark: "If separated / annulled" },
                                { item: "Proof of Billing", remark: "Proof of Address" },
                                { item: "Income Tax Return (individual / business)", remark: "Proof of Income" },
                                { item: "Certificate of Employment (COE)", remark: "Proof of Employment" },
                                { item: "Payslips (latest 3 months)", remark: "Proof of Income" },
                                { item: "Employment Agreement", remark: "Proof of Employment" },
                                { item: "Bank Statements (last 2 years)", remark: "Proof of Remittance / Deposits" },
                                { item: "Audited Financial Statement (last 2 years)", remark: "Business Document" },
                                { item: "Company Documents & Registrations", remark: "Business Document" },
                                { item: "List of Suppliers and Customers (3 each)", remark: "Business Document" },
                                { item: "Notarized Special Power of Attorney", remark: "If OFW / Dual Citizen residing in PH" },
                                { item: "Apostilled Special Power of Attorney", remark: "If OFW / Dual Citizen not residing in PH" },
                                { item: "Oath of Allegiance", remark: "If Dual Citizen" }
                              ].map((req, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 px-4 font-medium text-slate-700">{req.item}</td>
                                  <td className="py-3 px-4 text-xs text-slate-500">{req.remark}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      
                    </motion.div>
                  )}
                </div>

               <div className="border-t border-slate-100 p-6 bg-white flex justify-end gap-4 rounded-b-sm shrink-0">
                  <button onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-[11px] tracking-[0.25em] font-bold text-slate-500 uppercase hover:bg-slate-100 transition-colors">Cancel</button>
                  <button onClick={handleFormSubmit} disabled={isSubmitting} className="group relative flex items-center justify-center gap-6 bg-brand-blue px-8 py-4 overflow-hidden rounded-sm shadow-md">
                    <span className="absolute inset-0 bg-[#C5A071] transform -translate-x-full transition-transform group-hover:translate-x-0"></span>
                    <span className="relative z-10 text-[11px] tracking-[0.25em] font-bold text-white uppercase">{isSubmitting ? 'Sending...' : 'Submit Application'}</span>
                    <ArrowRight size={16} className="relative z-10 text-white" />
                  </button>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}

// Wrapper component necessary for Next.js routing dependencies
export default function PartnerBanks({ initialProjects, initialBanks, initialMappings }: PartnerBanksClientProps) {
  return (
    <Suspense fallback={null}>
      <PartnerBanksContent 
        initialProjects={initialProjects} 
        initialBanks={initialBanks} 
        initialMappings={initialMappings} 
      />
    </Suspense>
  );
}