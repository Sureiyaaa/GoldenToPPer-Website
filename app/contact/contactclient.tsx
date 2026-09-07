'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Lenis from 'lenis';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// ✅ Import the new Server Action
import { submitContactAction } from '@/app/actions/admin_fetchers';

// Zod Schema 
const contactFormSchema = z.object({
  firstName: z.string().min(2, { message: "Required" }),
  lastName: z.string().min(2, { message: "Required" }),
  email: z.string().email({ message: "Invalid email" }),
  phone: z.string()
    .min(1, { message: "Required" })
    .regex(/^[0-9]+$/, { message: "Numbers only" })
    .length(11, { message: "Must be 11 digits" }),
  typeOfInquiry: z.string().min(1, { message: "Select an option" }),
  message: z.string().optional()
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function ContactPage() {
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  // ✅ New state to control the error modal
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, message: string}>({
    isOpen: false,
    message: ''
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      typeOfInquiry: '',
      message: ''
    }
  });

  const selectedInquiry = watch('typeOfInquiry');
  const inquiryOptions = ['General Inquiry', 'Booking Inquiry', 'Property Sales', 'Partnerships', 'Customer Support'];

  const onSubmit = async (data: ContactFormValues) => {
    setIsSuccess(false);

    try {
      // ✅ Call the Server Action securely
      const result = await submitContactAction(data);

      if (!result.success) {
        throw new Error(result.error);
      }

      setIsSuccess(true);
      reset();
      
      // Auto-reset success state after 5 seconds if they want to submit another
      setTimeout(() => setIsSuccess(false), 5000);

    } catch (error: any) {
      console.error("Error submitting form:", error.message);
      // ✅ Trigger sleek Error Modal instead of alert()
      setModalConfig({
        isOpen: true,
        message: error.message || 'Something went wrong while submitting your inquiry. Please try again later.'
      });
    }
  };

  // Smooth Scrolling
  useEffect(() => {
    window.history.scrollRestoration = 'manual';
    const lenis = new Lenis({
      duration: 1.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    setTimeout(() => { window.scrollTo(0, 0); lenis.scrollTo(0, { immediate: true }); }, 50);
    function raf(time: number) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  // Reusable input styles utilizing the Blue (brand-blue) for focus states
  const inputStyles = "w-full bg-transparent border border-gray-300 rounded-md px-5 py-4 text-sm text-gray-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all duration-300 placeholder:text-gray-400";
  const textareaStyles = "w-full bg-transparent border border-gray-300 rounded-md px-5 py-4 text-sm text-gray-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all duration-300 placeholder:text-gray-400 resize-none";

  return (
    <main className="min-h-screen bg-[#E7E7E7] p-4 sm:p-6 lg:p-8 flex items-center justify-center font-sans selection:bg-brand-gold selection:text-white pt-8 lg:pt-8 relative">

      {/* ================= CUSTOM ERROR MODAL ================= */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full animate-in zoom-in-95 duration-300">
            
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-inner mb-2">
              <AlertCircle size={40} />
            </div>
            
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">
              Oops!
            </h2>
            <p className="text-gray-600 text-center text-sm font-medium">
              {modalConfig.message}
            </p>

            <div className="w-full mt-4">
              <button
                type="button"
                onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-brand-gold transition-colors text-xs uppercase tracking-widest outline-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Inner Container */}
      <div className="relative w-full max-w-[100rem] min-h-[calc(100vh-8rem)] rounded-2xl overflow-hidden flex flex-col lg:grid lg:grid-cols-[1fr_auto] lg:grid-rows-[auto_1fr] shadow-2xl">

        {/* Background Image & Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/story/2013_Milestone.png')" }}
        />
        {/* Blue gradient overlay tailored to the palette */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#142654]/95 via-brand-blue/85 to-black/30 mix-blend-multiply" />
        <div className="absolute inset-0 bg-black/10" />

        {/* ================= SECTION 1: TYPOGRAPHY (Top Left) ================= */}
        <div className="relative z-10 order-1 lg:col-start-1 lg:row-start-1 p-8 sm:p-12 lg:p-16 xl:p-24 lg:pb-8 text-white flex flex-col justify-start">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-white/70 hover:text-brand-gold transition-colors duration-300 mb-8 w-fit group outline-none"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform duration-300" />
              <span className="text-xs font-medium tracking-wide">Back to Home</span>
            </button>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-serif font-light leading-tight mb-6">
              You Have Questions,<br />
              <span className="text-brand-gold">We Have Answers</span>
            </h1>
            <p className="max-w-md text-white/80 text-sm sm:text-base font-light leading-relaxed">
              Discover experiences you won&apos;t find anywhere else — thoughtfully designed to immerse you in the heart of our premium destinations. Soulful stories waiting to be lived.
            </p>
          </motion.div>
        </div>

        {/* ================= SECTION 2: FORM CARD (Right Side) ================= */}
        <motion.div
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
          className="relative z-10 order-2 lg:col-start-2 lg:row-start-1 lg:row-span-2 w-full lg:w-[550px] xl:w-[650px] p-6 sm:p-8 lg:p-12 xl:pr-8 flex items-center justify-center"
        >
          <div className="bg-white rounded-xl p-8 sm:p-10 md:p-12 w-full min-h-[650px] shadow-2xl relative overflow-hidden flex flex-col justify-center">

            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-center h-full"
                >
                  <CheckCircle2 size={64} strokeWidth={1.5} className="text-brand-gold mb-6" />
                  <h3 className="text-3xl font-sans text-brand-blue mb-3">Message Sent</h3>
                  <p className="text-sm text-gray-500">Our team will be in touch with you shortly to assist with your inquiry.</p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onSubmit={handleSubmit(onSubmit)}
                  className="flex flex-col gap-6"
                >
                  <div className="mb-2">
                    <h2 className="text-xl sm:text-3xl font-serif text-brand-blue mb-2">Tell Us What You Need</h2>
                    <p className="text-sm text-gray-500">Our team is ready to assist you with every detail, big or small.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                      <input {...register("firstName")} type="text" className={inputStyles} placeholder="First Name" />
                      {errors.firstName && <span className="absolute -bottom-4 left-4 text-[9px] text-red-500">{errors.firstName.message}</span>}
                    </div>
                    <div className="relative">
                      <input {...register("lastName")} type="text" className={inputStyles} placeholder="Last Name" />
                      {errors.lastName && <span className="absolute -bottom-4 left-4 text-[9px] text-red-500">{errors.lastName.message}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                      <input {...register("email")} type="email" className={inputStyles} placeholder="Email Address" />
                      {errors.email && <span className="absolute -bottom-4 left-4 text-[9px] text-red-500">{errors.email.message}</span>}
                    </div>
                    <div className="relative">
                      <input {...register("phone")} type="tel" maxLength={11} className={inputStyles} placeholder="Phone Number" />
                      {errors.phone && <span className="absolute -bottom-4 left-4 text-[9px] text-red-500">{errors.phone.message}</span>}
                    </div>
                  </div>

                  {/* CUSTOM PILL SELECTOR FOR INQUIRY TYPE */}
                  <div className="relative pt-2">
                    <label className="text-xs text-gray-500 mb-3 block pl-2">Type of Inquiry</label>
                    <div className="flex flex-wrap gap-2">
                      {inquiryOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setValue("typeOfInquiry", opt, { shouldValidate: true })}
                          className={`px-4 py-2.5 rounded-md border text-xs font-medium transition-all outline-none ${selectedInquiry === opt
                              ? 'border-brand-gold text-white bg-brand-gold shadow-md shadow-brand-gold/20'
                              : 'border-gray-200 text-gray-500 hover:border-brand-gold hover:text-brand-gold'
                            }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {errors.typeOfInquiry && <span className="absolute -bottom-4 left-4 text-[9px] text-red-500">{errors.typeOfInquiry.message}</span>}
                  </div>

                  <div className="relative pt-2">
                    <textarea {...register("message")} rows={4} className={textareaStyles} placeholder="Your Message (Optional)" />
                    {errors.message && <span className="absolute -bottom-4 left-4 text-[9px] text-red-500">{errors.message.message}</span>}
                  </div>

                  <button
                    type="submit" disabled={isSubmitting}
                    className="w-full mt-4 py-4 rounded-md border border-brand-blue bg-brand-blue text-white text-sm font-semibold hover:border-brand-gold hover:bg-brand-gold transition-all duration-300 outline-none flex justify-center items-center gap-2 disabled:opacity-70 shadow-lg shadow-brand-blue/20 hover:shadow-brand-gold/30"
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Contact Us'}
                  </button>

                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </main>
  );
}