'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ArrowRight,
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { motion } from 'framer-motion';

import PageTransition from '../components/page-transitions';
import { submitInquiryAction } from '@/app/actions/admin_fetchers';

// ============================================================
// FORM VALIDATION
// ============================================================

const inquirySchema = z.object({
  firstName: z.string().min(1, 'First name is required'),

  lastName: z.string().min(1, 'Last name is required'),

  email: z.string().email('Enter a valid email address'),

  phone: z
    .string()
    .min(1, 'Contact number is required')
    .refine((val) => /^[0-9]+$/.test(val), {
      message: 'Invalid format. Numbers only.',
    })
    .refine((val) => val.length === 11, {
      message: 'Must be exactly 11 digits.',
    }),

  project: z.string().min(1, 'Please select a project'),
});

type InquiryFormData = z.infer<typeof inquirySchema>;

// ============================================================
// PROJECT TYPE
// ============================================================

interface ProjectOption {
  id: number;
  title: string;
}

const PROJECT_IMAGES: Record<number, string> = {
  1: '/images/projects/city-clou-inquire-img.jpg',
  2: '/images/projects/el_sol_inquire_img.png',
  3: '/images/projects/la-vida-inquire-img.png',
  4: '/images/projects/park-one.webp',
};

const DEFAULT_PROJECT_IMAGE =
  '/images/projects/city-clou-inquire-img.jpg';

// ============================================================
// COMPONENT
// ============================================================

export default function InquireClient({
  projects,
}: {
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ============================================================
  // MODAL
  // ============================================================

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    message: '',
  });

  // ============================================================
  // FORM
  // ============================================================

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InquiryFormData>({
    resolver: zodResolver(inquirySchema),

    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      project: '',
    },
  });

  // ============================================================
  // PROJECT FROM URL
  // ============================================================
  //
  // Example:
  //
  // /inquire?project=3
  //
  // projectFromUrl = "3"
  //

  const projectFromUrl = searchParams.get('project');

  // Current selected value from the dropdown
  const selectedProjectId = watch('project');

  // ============================================================
  // AUTO-SELECT PROJECT FROM URL
  // ============================================================

  useEffect(() => {
    // Wait until projects have loaded
    if (projects.length === 0) {
      return;
    }

    // User opened /inquire directly without ?project=
    if (!projectFromUrl) {
      return;
    }

    // Find the matching project
    const matchedProject = projects.find(
      (project) =>
        project.id.toString() === projectFromUrl
    );

    // URL contains an ID that doesn't exist
    if (!matchedProject) {
      console.warn(
        `Project ID "${projectFromUrl}" from URL was not found.`,
        projects
      );

      return;
    }

    // Automatically select the matching project
    setValue(
      'project',
      matchedProject.id.toString(),
      {
        shouldValidate: false,
        shouldDirty: false,
        shouldTouch: false,
      }
    );
  }, [projectFromUrl, projects, setValue]);

  // ============================================================
  // GET CURRENT PROJECT
  // ============================================================

  const selectedProject = projects.find(
    (project) =>
      project.id.toString() === selectedProjectId
  );

  // ============================================================
  // GET CURRENT PROJECT IMAGE
  // ============================================================

  const selectedProjectImage =
    selectedProject &&
    PROJECT_IMAGES[selectedProject.id]
      ? PROJECT_IMAGES[selectedProject.id]
      : DEFAULT_PROJECT_IMAGE;

  // ============================================================
  // FORM SUBMISSION
  // ============================================================

  const onSubmit = async (
    data: InquiryFormData
  ) => {
    try {
      const result =
        await submitInquiryAction(data);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Success modal
      setModalConfig({
        isOpen: true,
        type: 'success',
        message:
          'Your inquiry has been submitted successfully! Our team will contact you shortly.',
      });

      // Clear personal information,
      // but KEEP selected project
      reset({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        project:
          selectedProjectId ||
          projectFromUrl ||
          '',
      });
    } catch (error: unknown) {
      console.error(
        'Submission error:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while submitting your inquiry. Please try again later.';

      setModalConfig({
        isOpen: true,
        type: 'error',
        message,
      });
    }
  };

  // ============================================================
  // STYLES
  // ============================================================

  const inputStyles =
    'w-full bg-transparent border border-gray-300 rounded-md px-4 py-3 text-sm text-gray-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all duration-300 placeholder:text-gray-400';

  const labelStyles =
    'text-xs text-gray-500 mb-1.5 block pl-1';

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <PageTransition>
      <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#FDFBF7] font-sans selection:bg-brand-gold selection:text-white relative">

        {/* ====================================================
            SUCCESS / ERROR MODAL
        ==================================================== */}

        {modalConfig.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full animate-in zoom-in-95 duration-300">

              {modalConfig.type ===
              'success' ? (
                <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center shadow-inner mb-2">
                  <CheckCircle2
                    size={40}
                  />
                </div>
              ) : (
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-inner mb-2">
                  <AlertCircle
                    size={40}
                  />
                </div>
              )}

              <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">
                {modalConfig.type ===
                'success'
                  ? 'Success!'
                  : 'Oops!'}
              </h2>

              <p className="text-gray-600 text-center text-sm font-medium">
                {modalConfig.message}
              </p>

              <div className="w-full mt-4">
                <button
                  type="button"
                  onClick={() =>
                    setModalConfig(
                      (current) => ({
                        ...current,
                        isOpen: false,
                      })
                    )
                  }
                  className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-brand-gold transition-colors text-xs uppercase tracking-widest outline-none"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            LEFT SIDE — FORM
        ==================================================== */}

        <main className="w-full lg:w-4/12 flex flex-col justify-center h-full px-6 sm:px-10 lg:px-12 xl:px-16 z-10 relative">

          <div className="max-w-md w-full mx-auto">

            {/* BACK BUTTON */}

            <div className="mb-8 w-full flex justify-start">
              <button
                type="button"
                onClick={() =>
                  router.back()
                }
                className="flex items-center gap-3 text-brand-blue hover:text-brand-gold transition-all duration-300 group outline-none"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-300 group-hover:border-brand-gold transition-colors duration-500 bg-white shadow-sm shrink-0">
                  <ArrowLeft
                    size={14}
                    className="transform group-hover:-translate-x-0.5 transition-transform duration-500"
                  />
                </div>

                <span className="text-xs font-medium tracking-wide transition-colors duration-500">
                  Back
                </span>
              </button>
            </div>

            {/* ==================================================
                HEADER
            ================================================== */}

            <div className="mb-8 text-left">

              <h1 className="text-4xl lg:text-5xl font-serif font-normal text-brand-blue leading-tight mb-3 py-2 text-center">
                Inquire with{' '}

                <br className="hidden sm:block" />

                <motion.span
                  initial={{
                    backgroundPosition:
                      '200% center',
                  }}
                  animate={{
                    backgroundPosition:
                      '-200% center',
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 4,
                    ease: 'linear',
                  }}
                  className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-[#e6c96b] to-brand-gold bg-[length:200%_auto] pr-4 pb-1 overflow-visible"
                >
                  Golden Topper.
                </motion.span>
              </h1>

              <p className="text-gray-900 font-light text-xs sm:text-sm leading-relaxed pr-4 text-center">
                Register your interest
                today to receive exclusive
                floor plans, pricing
                details, and priority
                viewing opportunities.
              </p>
            </div>

            {/* ==================================================
                FORM
            ================================================== */}

            <form
              onSubmit={handleSubmit(
                onSubmit
              )}
              className="space-y-4"
            >

              {/* FIRST + LAST NAME */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">

                <div className="relative flex flex-col">
                  <label
                    className={
                      labelStyles
                    }
                  >
                    First Name
                  </label>

                  <input
                    {...register(
                      'firstName'
                    )}
                    type="text"
                    placeholder="e.g. John"
                    className={`${inputStyles} ${
                      errors.firstName
                        ? 'border-red-500'
                        : ''
                    }`}
                  />

                  {errors.firstName && (
                    <span className="absolute -bottom-4 left-2 text-[9px] text-red-500">
                      <AlertCircle
                        size={8}
                        className="inline mr-1"
                      />

                      {
                        errors.firstName
                          .message
                      }
                    </span>
                  )}
                </div>

                <div className="relative flex flex-col">
                  <label
                    className={
                      labelStyles
                    }
                  >
                    Last Name
                  </label>

                  <input
                    {...register(
                      'lastName'
                    )}
                    type="text"
                    placeholder="e.g. Doe"
                    className={`${inputStyles} ${
                      errors.lastName
                        ? 'border-red-500'
                        : ''
                    }`}
                  />

                  {errors.lastName && (
                    <span className="absolute -bottom-4 left-2 text-[9px] text-red-500">
                      <AlertCircle
                        size={8}
                        className="inline mr-1"
                      />

                      {
                        errors.lastName
                          .message
                      }
                    </span>
                  )}
                </div>
              </div>

              {/* EMAIL */}

              <div className="relative flex flex-col">
                <label
                  className={labelStyles}
                >
                  Email Address
                </label>

                <input
                  {...register('email')}
                  type="email"
                  placeholder="email@address.com"
                  className={`${inputStyles} ${
                    errors.email
                      ? 'border-red-500'
                      : ''
                  }`}
                />

                {errors.email && (
                  <span className="absolute -bottom-4 left-2 text-[9px] text-red-500">
                    <AlertCircle
                      size={8}
                      className="inline mr-1"
                    />

                    {
                      errors.email
                        .message
                    }
                  </span>
                )}
              </div>

              {/* PHONE */}

              <div className="relative flex flex-col">
                <label
                  className={labelStyles}
                >
                  Contact Number
                </label>

                <input
                  {...register('phone')}
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="09123456789"
                  className={`${inputStyles} ${
                    errors.phone
                      ? 'border-red-500'
                      : ''
                  }`}
                />

                {errors.phone && (
                  <span className="absolute -bottom-4 left-2 text-[9px] text-red-500">
                    <AlertCircle
                      size={8}
                      className="inline mr-1"
                    />

                    {
                      errors.phone
                        .message
                    }
                  </span>
                )}
              </div>

              {/* ==================================================
                  PROJECT DROPDOWN
              ================================================== */}

              <div className="relative flex flex-col">

                <label
                  className={labelStyles}
                >
                  Project of Interest
                </label>

                <div className="relative">

                  <select
                    {...register(
                      'project'
                    )}
                    className={`${inputStyles} appearance-none cursor-pointer bg-transparent ${
                      errors.project
                        ? 'border-red-500'
                        : ''
                    }`}
                  >
                    <option
                      value=""
                      disabled
                      className="text-gray-400"
                    >
                      Select a development
                    </option>

                    {projects.map(
                      (project) => (
                        <option
                          key={
                            project.id
                          }
                          value={project.id.toString()}
                          className="text-brand-blue"
                        >
                          {
                            project.title
                          }
                        </option>
                      )
                    )}
                  </select>

                  <ChevronDown
                    size={14}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${
                      errors.project
                        ? 'text-red-500'
                        : 'text-gray-400'
                    }`}
                  />
                </div>

                {errors.project && (
                  <span className="absolute -bottom-4 left-2 text-[9px] text-red-500">
                    <AlertCircle
                      size={8}
                      className="inline mr-1"
                    />

                    {
                      errors.project
                        .message
                    }
                  </span>
                )}
              </div>

              {/* ==================================================
                  SUBMIT
              ================================================== */}

              <div className="pt-4">

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group relative flex items-center justify-center gap-2 w-full bg-brand-blue rounded-md py-3.5 overflow-hidden shadow-lg shadow-brand-blue/20 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed outline-none"
                >
                  <span className="absolute inset-0 w-full h-full bg-brand-gold transform -translate-x-full transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0" />

                  <span className="relative z-10 text-sm font-semibold text-white transition-colors duration-500 group-hover:text-brand-blue flex items-center gap-2">

                    {isSubmitting ? (
                      <>
                        <Loader2
                          size={16}
                          className="animate-spin"
                        />

                        Processing...
                      </>
                    ) : (
                      'Submit Inquiry'
                    )}
                  </span>

                  {!isSubmitting && (
                    <ArrowRight
                      size={16}
                      className="relative z-10 text-white transition-colors duration-500 group-hover:text-brand-blue"
                    />
                  )}
                </button>

                <p className="text-[11px] text-gray-500 mt-4 leading-relaxed tracking-wide font-light text-center">
                  By submitting this form,
                  you agree to our{' '}
                  <a
                    href="/terms-of-use"
                    className="underline hover:text-brand-gold transition-colors"
                  >
                    Terms of Use
                  </a>{' '}
                  and{' '}
                  <a
                    href="/privacy-policy"
                    className="underline hover:text-brand-gold transition-colors"
                  >
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </form>
          </div>
        </main>

        {/* ====================================================
            RIGHT SIDE — PROJECT IMAGE
        ==================================================== */}

        <div className="hidden lg:block lg:w-8/12 relative h-full overflow-hidden bg-[#0A1128]">

          <motion.div
            key={selectedProjectImage}
            initial={{
              opacity: 0,
              scale: 1.015,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              duration: 0.45,
              ease: 'easeOut',
            }}
            className="absolute inset-0"
          >
            <Image
              src={
                selectedProjectImage
              }
              alt={
                selectedProject
                  ? `${selectedProject.title} - Golden Topper`
                  : 'Golden Topper Residence'
              }
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 67vw"
              className="object-cover opacity-90"
            />
          </motion.div>

          <div className="absolute inset-0 bg-gradient-to-t from-brand-blue/40 via-transparent to-transparent mix-blend-multiply pointer-events-none" />
        </div>
      </div>
    </PageTransition>
  );
}