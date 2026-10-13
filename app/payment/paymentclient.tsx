'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Navbar from "@/app/components/navbar";
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Check, Edit2 } from "lucide-react";
import PageTransition from "../components/page-transitions";
import { submitPaymentAction, fetchProjectsForPayment, fetchTowersForProject, fetchUnitTypesForTower } from "@/app/actions/payment";

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

// Full payment form schema - all steps combined
const paymentSchema = z.object({
  // Step 1: Payer Information
  firstName: z.string().min(1, "First name is required").regex(/^[a-zA-Z\s\-']+$/, "Invalid characters"),
  lastName: z.string().min(1, "Last name is required").regex(/^[a-zA-Z\s\-']+$/, "Invalid characters"),
  email: z.string().email("Enter a valid email address"),
  contactNumber: z.string()
    .min(11, "Contact number must be 11 digits")
    .max(11, "Contact number must be 11 digits")
    .regex(/^\d+$/, "Numbers only"),

  // Step 2: Property Details - use stable IDs
  projectId: z.string().min(1, "Please select a project").regex(/^\d+$/, "Invalid project"),
  towerId: z.string().min(1, "Tower is required").regex(/^\d+$/, "Invalid tower"),
  unitTypeId: z.string().min(1, "Unit type is required").regex(/^\d+$/, "Invalid unit type"),
  unitNumber: z.string()
    .min(1, "Unit number is required")
    .regex(/^\d+$/, "Must be digits only")
    .refine((val) => parseInt(val) > 0, "Must be a positive number"),

  // Step 3: Payment Details
  paymentPurpose: z.string().min(1, "Please select a payment purpose"),
  amount: z.string()
    .min(1, "Amount is required")
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid format (e.g. 1000.00)")
    .refine((val) => parseFloat(val) > 0, "Amount must be greater than zero"),
  paymentMethod: z.string().min(1, "Please select a payment method"),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

const PROPERTY_IMAGES = [
  "/images/projects/city-clou-amenities/function_room_cityclou.png",
  "/images/projects/el-sol-amenities/function_rooms_el_sol.png",
  "/images/projects/la-vida-amenities/function_rooms_lavida.png"
];

const PAYMENT_METHODS = [
  { id: "mastercard", label: "Mastercard", logo: "/images/payment/mastercard.svg" },
  { id: "bdo", label: "BDO Pay", logo: "/images/payment/bdo-pays.png" },
  { id: "gcash", label: "GCash", logo: "/images/payment/gcash.svg" },
  { id: "grabpay", label: "GrabPay", logo: "/images/payment/grabpay.png" },
  { id: "alipay", label: "Alipay", logo: "/images/payment/alipay.svg" },
  { id: "wechat", label: "WeChat Pay", logo: "/images/payment/wechatpay.png" },
  { id: "maya", label: "Maya", logo: "/images/payment/maya.jpg" },
  { id: "visa", label: "Visa", logo: "/images/payment/visa.svg" },
];

const STEPS = [
  { id: 1, label: 'Payer', title: 'Payer Information' },
  { id: 2, label: 'Property', title: 'Property Details' },
  { id: 3, label: 'Payment', title: 'Payment Details' },
  { id: 4, label: 'Review', title: 'Review & Confirm' },
];

// Navbar uses h-20, or h-16 + mt-4 when scrolled: both end at 5rem.
const NAVBAR_HEIGHT = '5rem';

export default function PaymentClient() {
  const [currentImg, setCurrentImg] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Turnstile state
  const turnstileWidgetIdRef = useRef<string | undefined>(undefined);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const stepContentRef = useRef<HTMLDivElement>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState('');
  const [serverError, setServerError] = useState('');

  // Project/Tower/UnitType data loading state
  const [projects, setProjects] = useState<Array<{ id: number; title: string }>>([]);
  const [towers, setTowers] = useState<Array<{ id: number; name: string }>>([]);
  const [unitTypes, setUnitTypes] = useState<Array<{ id: number; title: string }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTowers, setLoadingTowers] = useState(false);
  const [loadingUnitTypes, setLoadingUnitTypes] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    mode: "onBlur",
    defaultValues: {
      firstName: '', lastName: '', email: '', contactNumber: '',
      projectId: '', towerId: '', unitTypeId: '', unitNumber: '',
      paymentPurpose: '', amount: '', paymentMethod: '',
    }
  });

  const watchProjectId = watch("projectId");
  const watchTowerId = watch("towerId");
  const watchPaymentMethod = watch("paymentMethod");

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const data = await fetchProjectsForPayment();
        setProjects(data);
      } catch (err) {
        console.error('Error loading projects:', err);
      } finally {
        setLoadingProjects(false);
      }
    };
    loadProjects();
  }, []);

  // Load towers when project changes
  useEffect(() => {
    if (!watchProjectId) {
      setTowers([]);
      setUnitTypes([]);
      setValue('towerId', '', { shouldValidate: false });
      setValue('unitTypeId', '', { shouldValidate: false });
      return;
    }

    const loadTowers = async () => {
      setLoadingTowers(true);
      try {
        const projectId = parseInt(watchProjectId);
        const data = await fetchTowersForProject(projectId);
        setTowers(data);
      } catch (err) {
        console.error('Error loading towers:', err);
      } finally {
        setLoadingTowers(false);
      }
    };

    loadTowers();
  }, [watchProjectId, setValue]);

  // Load unit types when tower changes
  useEffect(() => {
    if (!watchTowerId || !watchProjectId) {
      setUnitTypes([]);
      setValue('unitTypeId', '', { shouldValidate: false });
      return;
    }

    const loadUnitTypes = async () => {
      setLoadingUnitTypes(true);
      try {
        const projectId = parseInt(watchProjectId);
        const towerIdNum = parseInt(watchTowerId);
        const tower = towers.find(t => t.id === towerIdNum);
        if (!tower) {
          setUnitTypes([]);
          return;
        }
        const data = await fetchUnitTypesForTower(projectId, tower.name);
        setUnitTypes(data);
      } catch (err) {
        console.error('Error loading unit types:', err);
      } finally {
        setLoadingUnitTypes(false);
      }
    };

    loadUnitTypes();
  }, [watchTowerId, watchProjectId, towers, setValue]);

  const nextImg = () => setCurrentImg((prev) => (prev + 1) % PROPERTY_IMAGES.length);
  const prevImg = () => setCurrentImg((prev) => (prev - 1 + PROPERTY_IMAGES.length) % PROPERTY_IMAGES.length);

  const inputStyles = "w-full bg-transparent border border-gray-300 rounded-md px-4 py-3 text-base md:text-sm text-gray-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all duration-300 placeholder:text-gray-400";
  const labelStyles = "text-xs text-gray-600 mb-2 block font-medium";
  const errorStyles = "text-xs text-red-600 mt-1.5 block pl-1 flex items-center gap-1";
  const primaryButtonStyles = "inline-flex h-12 min-w-[11rem] items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue disabled:bg-gray-400 disabled:cursor-not-allowed";

  // Step-specific field validation
  const step1Fields = ['firstName', 'lastName', 'email', 'contactNumber'] as const;
  const step2Fields = ['projectId', 'towerId', 'unitTypeId', 'unitNumber'] as const;
  const step3Fields = ['paymentPurpose', 'amount', 'paymentMethod'] as const;

  const validateAndMoveNext = async () => {
    let fieldsToValidate: readonly string[] = [];

    if (currentStep === 1) {
      fieldsToValidate = step1Fields;
    } else if (currentStep === 2) {
      fieldsToValidate = step2Fields;
    } else if (currentStep === 3) {
      fieldsToValidate = step3Fields;
    }

    const isValid = await trigger(fieldsToValidate as any);
    if (isValid) {
      setCompletedSteps([...new Set([...completedSteps, currentStep])]);
      setCurrentStep(currentStep + 1);
      setCaptchaToken(null); // Clear token when leaving review
      setCaptchaError('');
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setCaptchaToken(null);
      setCaptchaError('');
    }
  };

  const goToStep = (step: number) => {
    if (step < currentStep || completedSteps.includes(step)) {
      setCurrentStep(step);
      setCaptchaToken(null);
      setCaptchaError('');
    }
  };

  const onSubmit = async (data: PaymentFormData) => {
    // Check CAPTCHA on final submission
    if (!captchaToken) {
      setCaptchaError('Please complete the verification.');
      return;
    }

    try {
      setServerError('');
      console.log('[PAYMENT] Submitting payment with CAPTCHA token');

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
        console.log('[PAYMENT] Payment successful');
        alert('Payment processed successfully!');
      } else {
        setServerError('Unexpected response from server.');
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

  // CAPTCHA callbacks
  const handleCaptchaSuccess = useCallback((token: string) => {
    setCaptchaToken(token);
    setCaptchaError('');
    setServerError('');
  }, []);

  const handleCaptchaExpire = useCallback(() => {
    setCaptchaToken(null);
    setCaptchaError('');
  }, []);

  const handleCaptchaError = useCallback((errorCode: string) => {
    setCaptchaToken(null);
    setCaptchaError('Verification failed. Please try again.');
    console.warn(`[CAPTCHA] Error: ${errorCode}`);
  }, []);

  // Readiness is reactive so a script that loads after entering Review still renders.
  useEffect(() => {
    const scriptSrc = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    if (window.turnstile) {
      setTurnstileReady(true);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`);
    const script = existingScript ?? document.createElement('script');
    const onLoad = () => setTurnstileReady(true);
    const onError = () => setCaptchaError('Verification could not load. Please refresh and try again.');
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);

    if (!existingScript) {
      script.src = scriptSrc;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
  }, []);

  useEffect(() => {
    stepContentRef.current?.scrollTo({ top: 0 });
  }, [currentStep]);

  // Each visit to Review owns a fresh widget and clears it on exit/unmount.
  useEffect(() => {
    if (currentStep !== 4 || !turnstileReady || !process.env.NEXT_PUBLIC_PAYMENT_TURNSTILE_SITE_KEY) return;
    const container = document.getElementById('payment-captcha-container');
    if (!container || !window.turnstile) return;

    const widgetId = window.turnstile.render(container, {
      sitekey: process.env.NEXT_PUBLIC_PAYMENT_TURNSTILE_SITE_KEY,
      theme: 'light',
      action: 'payment',
      callback: handleCaptchaSuccess,
      'expired-callback': handleCaptchaExpire,
      'error-callback': handleCaptchaError,
      size: 'normal',
    });
    turnstileWidgetIdRef.current = widgetId;

    return () => {
      try {
        window.turnstile?.remove(widgetId);
      } catch {
        // The provider may already have removed the widget.
      }
      turnstileWidgetIdRef.current = undefined;
      setCaptchaToken(null);
    };
  }, [currentStep, turnstileReady, handleCaptchaSuccess, handleCaptchaExpire, handleCaptchaError]);

  // Step renderer components
  const StepIndicator = () => (
    <nav aria-label="Payment progress" className="pt-10 md:pt-11">
      <ol className="grid grid-cols-4">
        {STEPS.map((step) => {
          const isCompleted = completedSteps.includes(step.id);
          const isActive = currentStep === step.id;

          return (
            <li key={step.id} className="relative flex min-w-0 flex-col items-center gap-3">
              {step.id < STEPS.length && (
                <span aria-hidden="true" className={`absolute left-1/2 top-4 h-0.5 w-full ${
                  currentStep > step.id ? 'bg-brand-gold' : 'bg-gray-300'
                }`} />
              )}
              <button
                type="button"
                aria-label={step.title}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => goToStep(step.id)}
                disabled={!isCompleted && !isActive && step.id > currentStep}
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue ${
                  isActive
                    ? 'bg-brand-blue text-white ring-2 ring-brand-blue ring-offset-2'
                    : isCompleted
                    ? 'bg-brand-gold text-white hover:bg-yellow-600 cursor-pointer'
                    : 'bg-gray-300 text-gray-600 disabled:cursor-not-allowed'
                }`}
              >
                {isCompleted && !isActive ? <Check size={16} /> : step.id}
              </button>
              <span className={`text-[11px] sm:text-xs text-center ${
                isActive ? 'font-semibold text-brand-blue' : 'text-gray-600'
              }`}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  const EditButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs text-brand-blue hover:text-brand-gold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue"
    >
      <Edit2 size={14} />
      {label}
    </button>
  );

  // Step 1: Payer Information
  const Step1Content = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <label htmlFor="payment-first-name" className={labelStyles}>First Name</label>
            <input
              id="payment-first-name"
              {...register("firstName")}
              className={`${inputStyles} ${errors.firstName ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
              placeholder="John"
            />
            {errors.firstName && <span className={errorStyles}><AlertCircle size={12} />{errors.firstName.message}</span>}
          </div>

          <div className="flex flex-col">
            <label htmlFor="payment-last-name" className={labelStyles}>Last Name</label>
            <input
              id="payment-last-name"
              {...register("lastName")}
              className={`${inputStyles} ${errors.lastName ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
              placeholder="Doe"
            />
            {errors.lastName && <span className={errorStyles}><AlertCircle size={12} />{errors.lastName.message}</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <label htmlFor="payment-email" className={labelStyles}>Email Address</label>
            <input
              id="payment-email"
              {...register("email")}
              type="email"
              className={`${inputStyles} ${errors.email ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
              placeholder="email@address.com"
            />
            {errors.email && <span className={errorStyles}><AlertCircle size={12} />{errors.email.message}</span>}
          </div>

          <div className="flex flex-col">
            <label htmlFor="payment-contact" className={labelStyles}>Contact Number</label>
            <input
              id="payment-contact"
              {...register("contactNumber")}
              type="tel"
              inputMode="numeric"
              maxLength={11}
              className={`${inputStyles} ${errors.contactNumber ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
              placeholder="09XXXXXXXXX"
            />
            {errors.contactNumber && <span className={errorStyles}><AlertCircle size={12} />{errors.contactNumber.message}</span>}
          </div>
        </div>
    </div>
  );

  // Step 2: Property Details
  // Note: unitNumber is user-entered and not validated against inventory
  // (inventory source does not yet exist in the project database)
  const Step2Content = () => (
    <div className="space-y-6">
        <div className="flex flex-col">
          <label htmlFor="payment-project" className={labelStyles}>Project Name</label>
          <div className="relative">
            <select
              id="payment-project"
              {...register("projectId")}
              className={`${inputStyles} appearance-none cursor-pointer bg-white ${errors.projectId ? 'border-red-500' : ''}`}
              disabled={loadingProjects}
            >
              <option value="">Select Project</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id.toString()}>
                  {proj.title}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${errors.projectId ? 'text-red-500' : 'text-gray-400'}`} />
          </div>
          {errors.projectId && <span className={errorStyles}><AlertCircle size={12} />{errors.projectId.message}</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <label htmlFor="payment-tower" className={labelStyles}>Tower</label>
            <div className="relative">
              <select
                id="payment-tower"
                {...register("towerId")}
                className={`${inputStyles} appearance-none cursor-pointer bg-white ${!watchProjectId ? 'opacity-50 cursor-not-allowed' : ''} ${errors.towerId ? 'border-red-500' : ''}`}
                disabled={!watchProjectId || loadingTowers}
              >
                <option value="">
                  {!watchProjectId ? 'Select project first' : 'Select Tower'}
                </option>
                {towers.map((tower) => (
                  <option key={tower.id} value={tower.id.toString()}>
                    {tower.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${errors.towerId ? 'text-red-500' : 'text-gray-400'}`} />
            </div>
            {errors.towerId && <span className={errorStyles}><AlertCircle size={12} />{errors.towerId.message}</span>}
          </div>

          <div className="flex flex-col">
            <label htmlFor="payment-unit-type" className={labelStyles}>Unit Type</label>
            <div className="relative">
              <select
                id="payment-unit-type"
                {...register("unitTypeId")}
                className={`${inputStyles} appearance-none cursor-pointer bg-white ${!watchTowerId ? 'opacity-50 cursor-not-allowed' : ''} ${errors.unitTypeId ? 'border-red-500' : ''}`}
                disabled={!watchTowerId || loadingUnitTypes}
              >
                <option value="">
                  {!watchTowerId ? 'Select tower first' : 'Select Unit Type'}
                </option>
                {unitTypes.map((unit) => (
                  <option key={unit.id} value={unit.id.toString()}>
                    {unit.title}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${errors.unitTypeId ? 'text-red-500' : 'text-gray-400'}`} />
            </div>
            {errors.unitTypeId && <span className={errorStyles}><AlertCircle size={12} />{errors.unitTypeId.message}</span>}
          </div>
        </div>

        <div className="flex flex-col">
          <label htmlFor="payment-unit-number" className={labelStyles}>Unit Number</label>
          <input
            id="payment-unit-number"
            {...register("unitNumber")}
            type="text"
            inputMode="numeric"
            className={`${inputStyles} ${errors.unitNumber ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
            placeholder="e.g. 1008"
          />
          {errors.unitNumber && <span className={errorStyles}><AlertCircle size={12} />{errors.unitNumber.message}</span>}
        </div>
    </div>
  );

  // Step 3: Payment Details
  const Step3Content = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <label htmlFor="payment-purpose" className={labelStyles}>Purpose</label>
            <div className="relative">
              <select
                id="payment-purpose"
                {...register("paymentPurpose")}
                className={`${inputStyles} appearance-none cursor-pointer bg-white ${errors.paymentPurpose ? 'border-red-500' : ''}`}
              >
                <option value="">Select Purpose</option>
                <option value="Downpayment">Downpayment</option>
                <option value="Monthly Due">Monthly Due</option>
                <option value="Reservation Fee">Reservation Fee</option>
                <option value="CTS Reprinting Fee">CTS Reprinting Fee</option>
              </select>
              <ChevronDown size={14} className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${errors.paymentPurpose ? 'text-red-500' : 'text-gray-400'}`} />
            </div>
            {errors.paymentPurpose && <span className={errorStyles}><AlertCircle size={12} />{errors.paymentPurpose.message}</span>}
          </div>

          <div className="flex flex-col">
            <label htmlFor="payment-amount" className={labelStyles}>Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">₱</span>
              <input
                id="payment-amount"
                type="number"
                step="0.01"
                {...register("amount")}
                className={`${inputStyles} pl-8 ${errors.amount ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                placeholder="0.00"
              />
            </div>
            {errors.amount && <span className={errorStyles}><AlertCircle size={12} />{errors.amount.message}</span>}
          </div>
        </div>

        <div>
          <span id="payment-method-label" className={labelStyles}>Payment Method</span>
          <div role="group" aria-labelledby="payment-method-label" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PAYMENT_METHODS.map((method) => {
              const isSelected = watchPaymentMethod === method.label;
              return (
                <button
                  key={method.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setValue("paymentMethod", method.label, { shouldValidate: true })}
                  className={`relative flex flex-col items-center justify-center gap-2 px-3 py-3 rounded-lg border-2 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${
                    isSelected
                      ? 'border-brand-blue bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  title={method.label}
                >
                  <img
                    src={method.logo}
                    alt={method.label}
                    className="h-5 w-auto object-contain"
                  />
                  <span className="text-xs font-medium text-gray-700 text-center">{method.label}</span>
                  {isSelected && (
                    <Check size={14} className="absolute top-1 right-1 text-brand-blue" />
                  )}
                </button>
              );
            })}
          </div>
          {errors.paymentMethod && <span className={`${errorStyles} mt-2`}><AlertCircle size={12} />{errors.paymentMethod.message}</span>}
        </div>
    </div>
  );

  // Step 4: Review & Confirm
  const Step4Content = () => {
    const formData = watch();
    const selectedProject = projects.find(p => p.id.toString() === formData.projectId);
    const selectedTower = towers.find(t => t.id.toString() === formData.towerId);
    const selectedUnitType = unitTypes.find(u => u.id.toString() === formData.unitTypeId);
    const selectedPaymentMethod = PAYMENT_METHODS.find(m => m.label === formData.paymentMethod);
    const summaryStyles = "grid grid-cols-[minmax(0,1fr)_minmax(0,1.65fr)] gap-x-4 gap-y-2 text-xs sm:text-[13px] leading-4 [&>dt]:text-gray-500 [&>dd]:min-w-0 [&>dd]:font-medium [&>dd]:text-gray-900 [&>dd]:[overflow-wrap:anywhere]";

    return (
      <div>
        {/* Review Sections */}
        <div className="space-y-6">
          {/* Payer Information */}
          <section aria-label="Payer summary">
            <div className="flex justify-between items-center border-b border-gray-300 pb-1 mb-2">
              <h3 className="font-semibold text-sm leading-4 text-gray-800">Payer Information</h3>
              <EditButton onClick={() => goToStep(1)} label="Edit" />
            </div>
            <dl className={summaryStyles}>
              <dt>Name</dt>
              <dd>{formData.firstName} {formData.lastName}</dd>
              <dt>Email</dt>
              <dd>{formData.email}</dd>
              <dt>Contact</dt>
              <dd>{formData.contactNumber}</dd>
            </dl>
          </section>

          <section aria-label="Property summary">
            <div className="flex justify-between items-center border-b border-gray-300 pb-1 mb-2">
              <h3 className="font-semibold text-sm leading-4 text-gray-800">Property Details</h3>
              <EditButton onClick={() => goToStep(2)} label="Edit" />
            </div>
            <dl className={summaryStyles}>
              <dt>Project</dt>
              <dd>{selectedProject?.title}</dd>
              <dt>Tower</dt>
              <dd>{selectedTower?.name}</dd>
              <dt>Unit Type</dt>
              <dd>{selectedUnitType?.title}</dd>
              <dt>Unit Number</dt>
              <dd>{formData.unitNumber}</dd>
            </dl>
          </section>

          <section aria-label="Payment summary">
            <div className="flex justify-between items-center border-b border-gray-300 pb-1 mb-2">
              <h3 className="font-semibold text-sm leading-4 text-gray-800">Payment Details</h3>
              <EditButton onClick={() => goToStep(3)} label="Edit" />
            </div>
            <dl className={summaryStyles}>
              <dt>Purpose</dt>
              <dd>{formData.paymentPurpose}</dd>
              <dt>Amount</dt>
              <dd><strong className="font-semibold text-brand-blue">₱{parseFloat(formData.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></dd>
              <dt>Payment Method</dt>
              <dd>{selectedPaymentMethod?.label}</dd>
            </dl>
          </section>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div role="alert" className="bg-red-50 p-3 rounded border border-red-200 flex gap-2 mt-6">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-red-700">Payment Error</p>
              <p className="text-red-600">{serverError}</p>
            </div>
          </div>
        )}

        {/* Turnstile Widget */}
        {process.env.NEXT_PUBLIC_PAYMENT_TURNSTILE_SITE_KEY ? (
          <div className="mt-7 flex flex-col items-center">
            <div className="flex justify-center w-full">
              <div id="payment-captcha-container" className="min-h-[65px]" />
            </div>
            {captchaError && (
              <p role="alert" className="text-xs text-red-600 flex items-center gap-1 mt-2">
                <AlertCircle size={12} />
                {captchaError}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mt-7">
            <p className="text-xs text-yellow-800">
              ⚠️ Payment verification not configured. Add <code className="font-mono text-[10px]">NEXT_PUBLIC_PAYMENT_TURNSTILE_SITE_KEY</code> to .env.local
            </p>
          </div>
        )}

        {/* Terms */}
        <div className="mt-5">
          <p className="text-[11px] text-gray-500 leading-4 text-center">
            By providing this information, I agree to the Golden Topper Reservation Guidelines, Privacy Policy, and Terms of Service.
          </p>
        </div>

      </div>
    );
  };

  return (
    <PageTransition>
      <div className="flex min-h-[100dvh] flex-col md:h-[100dvh] md:overflow-hidden font-sans bg-[#E7E7E7] selection:bg-brand-gold selection:text-white">

        <Navbar />

        <main className="relative flex min-h-0 flex-1 flex-col md:flex-row">

          {/* LEFT SIDE - Property Image */}
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

          {/* RIGHT SIDE - Wizard Form */}
          <div
            className="relative z-10 mt-[var(--payment-navbar-height)] w-full bg-[#E7E7E7] px-2 min-[360px]:px-6 pb-7 md:h-[calc(100dvh-var(--payment-navbar-height))] md:w-1/2 lg:px-12 xl:px-16"
            style={{ '--payment-navbar-height': NAVBAR_HEIGHT } as React.CSSProperties}
          >
            <form
              onSubmit={currentStep === 4 ? handleSubmit(onSubmit) : (event) => { event.preventDefault(); void validateAndMoveNext(); }}
              className="mx-auto grid min-h-[calc(100dvh-var(--payment-navbar-height)-1.75rem)] w-full max-w-lg grid-rows-[auto_1fr_auto] md:h-full md:min-h-0 md:grid-rows-[auto_minmax(0,1fr)_auto]"
            >
              {StepIndicator()}

              <div ref={stepContentRef} className="min-h-0 pt-10 pb-5 md:overflow-y-auto md:[scrollbar-gutter:stable] [scrollbar-width:thin]">
                <h2 className="mb-6 text-2xl font-semibold leading-8 text-brand-blue">{STEPS[currentStep - 1].title}</h2>
                {/* Render helpers directly so state updates preserve inputs and the CAPTCHA DOM. */}
                {currentStep === 1 && Step1Content()}
                {currentStep === 2 && Step2Content()}
                {currentStep === 3 && Step3Content()}
                {currentStep === 4 && Step4Content()}
              </div>

              <footer className="flex items-center justify-between gap-3 border-t border-gray-300 pt-4">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex h-12 min-w-20 sm:min-w-24 items-center justify-center gap-2 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue"
                  >
                    <ChevronLeft size={16} aria-hidden="true" /> Back
                  </button>
                ) : <span aria-hidden="true" className="h-12 min-w-20 sm:min-w-24" />}

                {currentStep === 4 ? (
                  <button
                    type="submit"
                    disabled={isSubmitting || !captchaToken || !process.env.NEXT_PUBLIC_PAYMENT_TURNSTILE_SITE_KEY}
                    className={`${primaryButtonStyles} bg-brand-blue enabled:hover:bg-blue-800`}
                  >
                    {isSubmitting ? 'Processing...' : 'Pay Now'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={validateAndMoveNext}
                    className={`${primaryButtonStyles} bg-brand-blue hover:bg-blue-800`}
                  >
                    {currentStep === 3 ? 'Review Payment' : 'Continue'}
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                )}
              </footer>
            </form>
          </div>
        </main>

      </div>
    </PageTransition>
  );
}
