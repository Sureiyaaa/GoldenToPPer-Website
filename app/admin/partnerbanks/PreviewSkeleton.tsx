'use client';

import { motion } from 'framer-motion'; 

export default function PreviewSkeleton({ data }: { data: any }) {
  return (
    <div className="w-full max-w-sm mx-auto font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-sm p-8 shadow-2xl border border-slate-100 flex flex-col h-full pointer-events-none"
      >
        <div className="mb-8">
          <div className="h-20 mb-6 flex items-center">
            <img 
              src={data.image} 
              alt={data.bank_name} 
              className="max-h-full max-w-[140px] object-contain" 
            />
          </div>
          <h3 className="text-xl font-bold text-slate-800 leading-tight min-h-[3.5rem] flex items-center">
            {data.bank_name}
          </h3>
        </div>
        
        <div className="space-y-4 mb-6">
          <div className="flex justify-between items-end border-b border-slate-50 pb-2">
            <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Max Loan</span>
            <span className="text-2xl font-bold text-[#132243]">{data.max_loan}%</span>
          </div>
          <div className="flex justify-between items-end border-b border-slate-50 pb-2">
            <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Terms</span>
            <span className="text-lg font-semibold text-slate-700">{data.terms}</span>
          </div>
        </div>
        
        <p className="text-sm text-slate-500 leading-relaxed mt-auto bg-slate-50 p-4 rounded-sm">
          {data.short_description}
        </p>
      </motion.div>

      <div className="mt-8 text-center">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
          This container will appear inside the grid on the Partner Banks page.
        </p>
      </div>
    </div>
  );
}