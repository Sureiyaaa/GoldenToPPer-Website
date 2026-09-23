'use client';

import { motion } from 'framer-motion';

type PreviewRegion = 'details' | 'financing' | 'description' | 'logo';

interface PreviewSkeletonProps {
  data: {
    bank_name?: string;
    max_loan?: string;
    terms?: string;
    short_description?: string;
    image?: string;
  };
  selectedRegion?: string;
  onSelectRegion?: (region: PreviewRegion) => void;
}

export default function PreviewSkeleton({
  data,
  selectedRegion,
  onSelectRegion,
}: PreviewSkeletonProps) {
  const regionClass = (region: PreviewRegion) =>
    `relative rounded-xl transition-all ${
      selectedRegion === region
        ? 'ring-2 ring-brand-gold ring-offset-4 ring-offset-white'
        : 'hover:ring-2 hover:ring-brand-gold/40 hover:ring-offset-4 hover:ring-offset-white'
    }`;

  return (
    <div className="w-full max-w-md mx-auto font-sans">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-full flex-col rounded-3xl border border-slate-100 bg-white p-8 shadow-2xl shadow-brand-blue/10"
      >
        <div className="mb-8">
          <button
            type="button"
            onClick={() => onSelectRegion?.('logo')}
            className={`${regionClass('logo')} mb-6 flex h-24 w-full items-center justify-start bg-slate-50/70 p-4 text-left`}
          >
            {data.image ? (
              <img
                src={data.image}
                alt={data.bank_name || 'Bank logo'}
                className="max-h-full max-w-[170px] object-contain"
              />
            ) : (
              <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
                Bank Logo
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectRegion?.('details')}
            className={`${regionClass('details')} block w-full px-1 py-1 text-left`}
          >
            <h3 className="min-h-[3.5rem] text-2xl font-bold leading-tight text-slate-800">
              {data.bank_name || 'Bank Name'}
            </h3>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSelectRegion?.('financing')}
          className={`${regionClass('financing')} mb-6 block w-full p-1 text-left`}
        >
          <div className="space-y-4">
            <div className="flex items-end justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Max Loan
              </span>
              <span className="text-3xl font-bold text-[#132243]">
                {data.max_loan || '80'}%
              </span>
            </div>
            <div className="flex items-end justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Terms
              </span>
              <span className="max-w-[60%] text-right text-lg font-semibold text-slate-700">
                {data.terms || 'Up to 20 years'}
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectRegion?.('description')}
          className={`${regionClass('description')} mt-auto block w-full bg-slate-50 p-5 text-left`}
        >
          <p className="text-sm leading-relaxed text-slate-500">
            {data.short_description || 'Write a brief description of this bank financing offer.'}
          </p>
        </button>
      </motion.div>

      <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
        Click the bank card to edit that content
      </p>
    </div>
  );
}
