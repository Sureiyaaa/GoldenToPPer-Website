'use client';

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Navbar from "@/app/components/navbar";
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import PageTransition from "../components/page-transitions";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { submitPaymentAction } from "@/app/actions/payment";

declare global {
  interface Window {
    turnstile: {
      render: (element: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string;
    };
  }
}

const paymentSchema = z.object({
  paymentMethod: z.string().min(1, "Please select a payment method"),
  firstName: z.string().min(1, "First name is required").regex(/^[a-zA-Z\s\-']+$/, "Invalid characters"),
  lastName: z.string().min(1, "Last name is required").regex(/^[a-zA-Z\s\-']+$/, "Invalid characters"),
  email: z.string().email("Enter a valid email address"),
  contactNumber: z.string()
    .min(10, "Contact number must be 11 digits")
    .regex(/^\d+$/, "Numbers only"),
  project: z.string().min(1, "Please select a project"),
  tower: z.string().min(1, "Tower is required"),
  unit: z.string().min(1, "Unit number is required").regex(/^[a-zA-Z0-9\-]+$/, "Invalid characters"),
  paymentPurpose: z.string().min(1, "Please select a payment purpose"),
  amount: z.string()
    .min(1, "Amount is required")
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid format (e.g. 1000.00)")
    .refine((val) => parseFloat(val) > 0, "Amount must be greater than zero"),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

const PROPERTY_IMAGES = [
  "/images/projects/city-clou-amenities/function_room_cityclou.png",
  "/images/projects/el-sol-amenities/function_rooms_el_sol.png",
  "/images/projects/la-vida-amenities/function_rooms_lavida.png"
];

const PAYMENT_METHODS = [
  { id: "bdo", label: "BDO Pay", logo: "/images/payment/bdo-pays.png" },
  { id: "gcash", label: "GCash", logo: "/images/payment/gcash.svg" },
  { id: "grabpay", label: "GrabPay", logo: "/images/payment/grabpay.png" },
  { id: "alipay", label: "Alipay", logo: "/images/payment/alipay.svg" },
  { id: "wechat", label: "WeChat Pay", logo: "/images/payment/wechatpay.png" },
  { id: "maya", label: "Maya", logo: "/images/payment/maya.jpg" },
  { id: "visa", label: "Visa", logo: "/images/payment/visa.svg" },
  { id: "mastercard", label: "Mastercard", logo: "/images/payment/mastercard.svg" },
];

export default function PaymentClient() {
  const [currentImg, setCurrentImg] = useState(0);

  // Marquee Drag Refs
  const marqueeRef = useRef<HTMLDivElement>(null);
  const marqueeTween = useRef<gsap.core.Tween | null>(null);
  const dragState = useRef({ isDragging: false, startX: 0, currentProgress: 0 });

  // Turnstile state
  const turnstileWidgetIdRef = useRef<string | undefined>(undefined);
  const scriptLoadedRef = useRef(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState('');
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    mode: "onChange",
    defaultValues: {
      paymentMethod: '', firstName: '', lastName: '', email: '', contactNumber: '',
      project: '', tower: '', unit: '', paymentPurpose: '', amount: '',
    }
  });

  const watchProject = watch("project");
  const watchPaymentMethod = watch("paymentMethod");

  const onSubmit = async (data: PaymentFormData) => {
    // Check CAPTCHA before submission
    if (!captchaToken) {
      setCaptchaError('Please complete the verification.');
      return;
    }

    try {
      setServerError('');
      console.log('[PAYMENT] Submitting payment with CAPTCHA token');

      // Call server action with payment data and CAPTCHA token
      const result = await submitPaymentAction(data, captchaToken);

      if (result?.error) {
        console.log(`[PAYMENT] Server returned error: ${result.error}`);
        setServerError(result.error);

        // Reset CAPTCHA widget for retry
        if (turnstileWidgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(turnstileWidgetIdRef.current);
          } catch (e) {
            console.error('[CAPTCHA] Failed to reset widget:', e);
          }
        }
        setCaptchaToken(null);
      } else if (result?.success) {
        // Successful payment (future - not yet implemented)
        console.log('[PAYMENT] Payment successful');
        alert('Payment processed successfully!');
      } else {
        // Unexpected response
        setServerError('Unexpected response from server.');

        // Reset CAPTCHA for retry
        if (turnstileWidgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(turnstileWidgetIdRef.current);
          } catch (e) {
            console.error('[CAPTCHA] Failed to reset widget:', e);
          }
        }
        setCaptchaToken(null);
      }
    } catch (error) {
      console.error('[PAYMENT] Submission error:', error);
      setServerError('An error occurred. Please try again.');

      // Reset CAPTCHA on unexpected error
      if (turnstileWidgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        } catch (e) {
          console.error('[CAPTCHA] Failed to reset widget:', e);
        }
      }
      setCaptchaToken(null);
    }
  };

  const nextImg = () => setCurrentImg((prev) => (prev + 1) % PROPERTY_IMAGES.length);
  const prevImg = () => setCurrentImg((prev) => (prev - 1 + PROPERTY_IMAGES.length) % PROPERTY_IMAGES.length);

  const inputStyles = "w-full bg-transparent border border-gray-300 rounded-md px-4 py-3 text-base md:text-sm text-gray-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all duration-300 placeholder:text-gray-400";
  const labelStyles = "text-xs text-gray-500 mb-1.5 block pl-1";

  // Duplicate the array 4 times to create enough overflow for a seamless infinite loop at xPercent: -50
  const marqueeItems = [...PAYMENT_METHODS, ...PAYMENT_METHODS, ...PAYMENT_METHODS, ...PAYMENT_METHODS];

  // Load Turnstile widget on mount
  useEffect(() => {
    if (scriptLoadedRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      const renderWidget = () => {
        const container = document.getElementById('payment-captcha-container');
        if (container && window.turnstile) {
          const widgetId = window.turnstile.render('#payment-captcha-container', {
            sitekey: process.env.NEXT_PUBLIC_PAYMENT_TURNSTILE_SITE_KEY,
            theme: 'light',
            action: 'payment',
            callback: handleCaptchaSuccess,
            'expired-callback': handleCaptchaExpire,
            'error-callback': handleCaptchaError,
            size: 'normal',
          });
          turnstileWidgetIdRef.current = widgetId;
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderWidget);
      } else {
        renderWidget();
      }
    };

    document.head.appendChild(script);
    scriptLoadedRef.current = true;

    return () => {
      if (turnstileWidgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch (e) {
          // Widget may have already been removed
        }
      }
    };
  }, []);

  // GSAP Infinite Marquee Initialization
  useGSAP(() => {
    if (!marqueeRef.current) return;
    marqueeTween.current = gsap.to(marqueeRef.current, {
      xPercent: -50,
      ease: 'none',
      duration: 25,
      repeat: -1,
    });
  });

  // CAPTCHA callbacks
  const handleCaptchaSuccess = (token: string) => {
    setCaptchaToken(token);
    setCaptchaError('');
    setServerError('');
  };

  const handleCaptchaExpire = () => {
    setCaptchaToken(null);
    setCaptchaError('');
  };

  const handleCaptchaError = (errorCode: string) => {
    setCaptchaToken(null);
    setCaptchaError('Verification failed. Please try again.');
    console.warn(`[CAPTCHA] Error: ${errorCode}`);
  };

  // Marquee Drag Event Handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!marqueeTween.current) return;
    dragState.current.isDragging = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    dragState.current.startX = clientX;
    dragState.current.currentProgress = marqueeTween.current.progress();
    marqueeTween.current.pause();
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragState.current.isDragging || !marqueeTween.current || !marqueeRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const deltaX = clientX - dragState.current.startX;

    // Calculate drag distance relative to the marquee's total translation length
    const totalDistance = marqueeRef.current.offsetWidth * 0.5;
    let newProgress = dragState.current.currentProgress - (deltaX / totalDistance);

    // Smooth infinite wrapping in both directions
    while (newProgress < 0) newProgress += 1;
    while (newProgress > 1) newProgress -= 1;

    marqueeTween.current.progress(newProgress);
  };

  const handleDragEnd = () => {
    if (!dragState.current.isDragging || !marqueeTween.current) return;
    dragState.current.isDragging = false;
    marqueeTween.current.play();
  };

  return (
    <PageTransition>
      <style dangerouslySetInnerHTML={{__html: `
        .fade-edges {
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
      `}} />

      <div className="flex flex-col h-[100dvh] overflow-hidden font-sans bg-[#E7E7E7] selection:bg-brand-gold selection:text-white">
        
        <Navbar />

        <main className="flex-grow flex flex-col md:flex-row relative h-full overflow-hidden">
          
          {/* LEFT SIDE */}
          <div className="hidden md:block w-full md:w-1/2 relative h-full z-0 group bg-black">
            <div 
              className="absolute inset-0 bg-cover bg-center transition-all duration-700 ease-in-out opacity-90"
              style={{ backgroundImage: `url(${PROPERTY_IMAGES[currentImg]})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-blue/80 via-transparent to-black/20 mix-blend-multiply" />

            <button 
              type="button" onClick={prevImg} 
              className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-brand-blue text-white hover:bg-brand-gold rounded-full transition-all outline-none shadow-lg z-10"
            >
              <ChevronLeft size={20} strokeWidth={1.5} />
            </button>
            <button 
              type="button" onClick={nextImg} 
              className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-brand-blue text-white hover:bg-brand-gold rounded-full transition-all outline-none shadow-lg z-10"
            >
              <ChevronRight size={20} strokeWidth={1.5} />
            </button>

            <div className="absolute bottom-10 left-10 md:bottom-12 md:left-12 text-white z-10">
              <p className="text-[11px] font-medium tracking-wide text-white mb-2 drop-shadow-md">
                Property View {currentImg + 1} of {PROPERTY_IMAGES.length}
              </p>
              <h2 className="text-4xl lg:text-5xl font-serif font-normal leading-tight drop-shadow-xl">
                <span className="text-brand-gold">Golden Topper</span>
              </h2>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="w-full md:w-1/2 bg-[#E7E7E7] px-6 md:px-12 lg:px-16 relative z-10 flex flex-col justify-start md:justify-center h-full overflow-y-auto pt-24 pb-8 md:py-0">
            
            <div className="max-w-lg w-full mx-auto pb-12 md:pb-0 mt-12">
              <div className="mb-5 md:mb-4">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold text-brand-blue leading-tight mb-3 md:mb-3 md:mt-0">
                  Payment <span className="text-brand-gold">Method</span>
                </h1>
                
                {/* Seamless Draggable Marquee Logo Selector */}
                <div 
                  className="relative w-full overflow-hidden fade-edges py-2 cursor-grab active:cursor-grabbing select-none"
                  style={{ touchAction: 'pan-y' }}
                  onMouseDown={handleDragStart}
                  onMouseMove={handleDragMove}
                  onMouseUp={handleDragEnd}
                  onMouseLeave={handleDragEnd}
                  onTouchStart={handleDragStart}
                  onTouchMove={handleDragMove}
                  onTouchEnd={handleDragEnd}
                >
                  <div ref={marqueeRef} className="flex w-max gap-8 items-center px-4">
                    {marqueeItems.map((method, index) => {
                      const isSelected = watchPaymentMethod === method.label;
                      return (
                        <button
                          key={`${method.id}-${index}`}
                          type="button"
                          onClick={() => setValue("paymentMethod", method.label, { shouldValidate: true })}
                          className={`relative flex-shrink-0 transition-all duration-300 transform outline-none ${
                            isSelected
                              ? 'scale-110 grayscale-0 opacity-100 drop-shadow-md'
                              : 'opacity-60 hover:grayscale-0 hover:opacity-100 hover:scale-105'
                          }`}
                          title={method.label}
                        >
                          <img 
                            src={method.logo} 
                            alt={method.label} 
                            className="h-7 w-auto object-contain pointer-events-none"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
                {errors.paymentMethod && (
                  <span className="block mt-2 text-[10px] text-red-500">
                    <AlertCircle size={10} className="inline mr-1" />
                    {errors.paymentMethod.message}
                  </span>
                )}
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5 md:space-y-3">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 md:gap-y-3">
                  <div className="relative flex flex-col">
                    <label className={labelStyles}>First Name</label>
                    <input 
                      {...register("firstName")} 
                      className={`${inputStyles} ${errors.firstName ? 'border-red-500' : ''}`} 
                      placeholder="e.g. John" 
                    />
                    {errors.firstName && <span className="absolute -bottom-4 left-2 text-[9px] text-red-500"><AlertCircle size={8} className="inline mr-1"/>{errors.firstName.message}</span>}
                  </div>

                  <div className="relative flex flex-col">
                    <label className={labelStyles}>Last Name</label>
                    <input 
                      {...register("lastName")} 
                      className={`${inputStyles} ${errors.lastName ? 'border-red-500' : ''}`} 
                      placeholder="e.g. Doe" 
                    />
                    {errors.lastName && <span className="absolute -bottom-4 left-2 text-[9px] text-red-500"><AlertCircle size={8} className="inline mr-1"/>{errors.lastName.message}</span>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 md:gap-y-3">
                  <div className="relative flex flex-col">
                    <label className={labelStyles}>Email Address</label>
                    <input 
                      {...register("email")} 
                      className={`${inputStyles} ${errors.email ? 'border-red-500' : ''}`} 
                      placeholder="email@address.com" 
                    />
                    {errors.email && <span className="absolute -bottom-4 left-2 text-[9px] text-red-500"><AlertCircle size={8} className="inline mr-1"/>{errors.email.message}</span>}
                  </div>

                  <div className="relative flex flex-col">
                    <label className={labelStyles}>Contact Number</label>
                    <input 
                      {...register("contactNumber")} 
                      className={`${inputStyles} ${errors.contactNumber ? 'border-red-500' : ''}`} 
                      placeholder="0912 345 6789" 
                    />
                    {errors.contactNumber && <span className="absolute -bottom-4 left-2 text-[9px] text-red-500"><AlertCircle size={8} className="inline mr-1"/>{errors.contactNumber.message}</span>}
                  </div>
                </div>

                <div className="relative flex flex-col">
                  <label className={labelStyles}>Project Name</label>
                  <div className="relative">
                    <select 
                      {...register("project")} 
                      className={`${inputStyles} appearance-none cursor-pointer bg-transparent ${errors.project ? 'border-red-500' : ''}`}
                    >
                      <option value="" disabled className="text-gray-400">Select Project</option>
                      <option value="City Clou" className="text-gray-900">City Clou</option>
                      <option value="Park One" className="text-gray-900">Park One</option>
                      <option value="El Sol" className="text-gray-900">El Sol</option>
                      <option value="La Vida" className="text-gray-900">La Vida</option>
                    </select>
                    <ChevronDown size={14} className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${errors.project ? 'text-red-500' : 'text-gray-400'}`} />
                  </div>
                  {errors.project && <span className="absolute -bottom-4 left-2 text-[9px] text-red-500"><AlertCircle size={8} className="inline mr-1"/>{errors.project.message}</span>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 md:gap-y-3">
                  <div className="relative flex flex-col">
                    <label className={labelStyles}>Tower</label>
                    <input 
                      {...register("tower")} 
                      className={`${inputStyles} ${errors.tower ? 'border-red-500' : ''}`} 
                      placeholder="e.g. Tower A" 
                    />
                    {errors.tower && <span className="absolute -bottom-4 left-2 text-[9px] text-red-500"><AlertCircle size={8} className="inline mr-1"/>{errors.tower.message}</span>}
                  </div>

                  <div className="relative flex flex-col">
                    <label className={labelStyles}>Unit Number</label>
                    <input 
                      {...register("unit")} 
                      className={`${inputStyles} ${errors.unit ? 'border-red-500' : ''}`} 
                      placeholder="e.g. 1008" 
                    />
                    {errors.unit && <span className="absolute -bottom-4 left-2 text-[9px] text-red-500"><AlertCircle size={8} className="inline mr-1"/>{errors.unit.message}</span>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 md:gap-y-3">
                  <div className="relative flex flex-col">
                    <label className={labelStyles}>Purpose</label>
                    <div className="relative">
                      <select 
                        {...register("paymentPurpose")} 
                        className={`${inputStyles} appearance-none cursor-pointer bg-transparent ${errors.paymentPurpose ? 'border-red-500' : ''}`}
                      >
                        <option value="" disabled className="text-gray-400">Select</option>
                        <option value="Downpayment" className="text-gray-900">Downpayment</option>
                        <option value="Monthly Due" className="text-gray-900">Monthly Due</option>
                        <option value="Reservation Fee" className="text-gray-900">Reservation Fee</option>
                        <option value="CTS Reprinting Fee" className="text-gray-900">CTS Reprinting Fee</option>
                      </select>
                      <ChevronDown size={14} className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${errors.paymentPurpose ? 'text-red-500' : 'text-gray-400'}`} />
                    </div>
                    {errors.paymentPurpose && <span className="absolute -bottom-4 left-2 text-[9px] text-red-500"><AlertCircle size={8} className="inline mr-1"/>{errors.paymentPurpose.message}</span>}
                  </div>
                  
                  <div className="relative flex flex-col">
                    <label className={labelStyles}>Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">₱</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        {...register("amount")} 
                        className={`${inputStyles} pl-8 ${errors.amount ? 'border-red-500' : ''}`} 
                        placeholder="0.00" 
                      />
                    </div>
                    {errors.amount && <span className="absolute -bottom-4 left-2 text-[9px] text-red-500"><AlertCircle size={8} className="inline mr-1"/>{errors.amount.message}</span>}
                  </div>
                </div>

                {/* Server-side error alert */}
                {serverError && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex gap-3">
                    <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Payment Error</p>
                      <p className="text-sm text-red-600 mt-0.5">{serverError}</p>
                    </div>
                  </div>
                )}

                {/* Cloudflare Turnstile Widget */}
                {process.env.NEXT_PUBLIC_PAYMENT_TURNSTILE_SITE_KEY ? (
                  <div className="pt-4 pb-3 flex flex-col items-center">
                    <div className="flex justify-center w-full">
                      <div id="payment-captcha-container" />
                    </div>
                    {captchaError && (
                      <p className="text-sm text-red-600 flex items-center gap-1 mt-2.5">
                        <AlertCircle size={14} />
                        {captchaError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Payment verification not configured. Add <code className="font-mono text-xs">NEXT_PUBLIC_PAYMENT_TURNSTILE_SITE_KEY</code> to .env.local
                    </p>
                  </div>
                )}

                <div className="pt-3 md:pt-2.5">
                  <p className="text-[11px] text-gray-500 font-light leading-relaxed text-center mb-2.5">
                    By providing this information, I agree to the Golden Topper Reservation Guidelines, Privacy Policy, and Terms of Service.
                  </p>

                  <button
                    type="submit"
                    disabled={isSubmitting || !captchaToken || !process.env.NEXT_PUBLIC_PAYMENT_TURNSTILE_SITE_KEY}
                    className="group relative flex items-center justify-center w-full bg-brand-blue rounded-md py-3.5 overflow-hidden shadow-lg shadow-brand-blue/20 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed outline-none"
                  >
                    <span className="absolute inset-0 w-full h-full bg-brand-gold transform -translate-x-full transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0"></span>
                    <span className="relative z-10 text-sm font-semibold text-white transition-colors duration-500 group-hover:text-brand-blue">
                      {isSubmitting ? "Processing..." : "Pay Now"}
                    </span>
                  </button>
                </div>
                
              </form>
            </div>
          </div>
        </main>
        
      </div>
    </PageTransition>
  );
}