'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, UserCircle2, CornerUpLeft, Loader2, Building2, Calendar, Mail, Phone } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

function InquiryDetail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id'); // Grabs ?id=123 from the URL
  const [inquiry, setInquiry] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    const fetchInquiry = async () => {
      const { data } = await supabase
        .from('inquire')
        .select(`id, created_at, is_read, client (first_name, last_name, email, phone_number), project_table (title)`)
        .eq('id', id)
        .single();
        
      if (data) {
        // Normalize Supabase arrays
        const clientData = Array.isArray(data.client) ? data.client[0] : data.client;
        const projectData = Array.isArray(data.project_table) ? data.project_table[0] : data.project_table;

        setInquiry({
          ...data,
          client: clientData,
          project_table: projectData
        });

        // Automatically mark as read if visited directly
        if (!data.is_read) {
          await supabase.from('inquire').update({ is_read: true }).eq('id', id);
        }
      }
      setIsLoading(false);
    };
    
    fetchInquiry();
  }, [id, supabase]);

  if (isLoading) return <div className="flex justify-center items-center min-h-screen bg-white"><Loader2 className="animate-spin text-brand-blue" size={32} /></div>;
  if (!inquiry) return <div className="min-h-screen bg-white flex flex-col justify-center items-center text-gray-500"><p className="mb-4">Inquiry not found.</p><button onClick={() => router.push('/admin/dashboard')} className="text-brand-blue font-bold hover:underline">Return to Dashboard</button></div>;

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col w-full">
      
      {/* 1. FULL WIDTH STICKY TOOLBAR */}
      <div className="w-full border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-10 px-6 sm:px-10 py-4 flex items-center justify-between">
        <button onClick={() => router.push('/admin/dashboard')} className="flex items-center gap-3 text-gray-500 hover:text-brand-blue font-semibold text-sm transition-colors group outline-none">
          <span className="p-2 bg-gray-50 group-hover:bg-brand-blue/10 rounded-full transition-colors">
            <ArrowLeft size={18} />
          </span>
          Back to Dashboard
        </button>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
          <Calendar size={14} />
          {new Date(inquiry.created_at).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>

      {/* 2. FULL WIDTH CONTENT AREA WITH PADDING */}
      <div className="w-full px-6 sm:px-12 lg:px-20 py-12 flex-1">
        
        {/* Massive Impactful Header */}
        <h1 className="text-4xl md:text-5xl font-serif text-brand-blue mb-12 leading-tight">
          Property Inquiry: <br className="hidden md:block" />
          <span className="text-brand-gold">{inquiry.project_table?.title || 'Unknown Project'}</span>
        </h1>

        {/* Full-width Sender Info Row */}
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between border-y border-gray-100 py-6 mb-12 gap-6">
          <div className="flex items-center gap-5">
            <UserCircle2 size={56} className="text-gray-200" strokeWidth={1} />
            <div>
              <div className="text-xl font-medium text-gray-900 mb-1">
                {inquiry.client?.first_name} {inquiry.client?.last_name}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1.5"><Mail size={14} className="text-gray-400"/> {inquiry.client?.email}</span>
                <span className="flex items-center gap-1.5"><Phone size={14} className="text-gray-400"/> {inquiry.client?.phone_number || 'No phone provided'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. CONSTRAINED MESSAGE AREA (For Readability) */}
        <div className="max-w-[85ch]">
          <div className="text-base text-gray-800 leading-loose">
            <p className="mb-6">Hello,</p>
            <p className="mb-8 text-lg">
              I am interested in getting more information about the property <strong>{inquiry.project_table?.title}</strong>. Please contact me at your earliest convenience to discuss availability, pricing, and potential viewing schedules.
            </p>
            
            {/* Impactful Property Tag */}
            <div className="bg-[#f8f9fa] border-l-4 border-brand-gold p-6 inline-flex flex-col gap-2 rounded-r-xl">
              <div className="flex items-center gap-2 text-brand-blue/50 text-xs font-bold uppercase tracking-widest">
                <Building2 size={16} /> Target Property
              </div>
              <div className="text-2xl font-serif text-brand-blue">{inquiry.project_table?.title}</div>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-16 pt-8 border-t border-gray-100">
            <a 
              href={`mailto:${inquiry.client?.email}?subject=RE: Property Inquiry - ${inquiry.project_table?.title}`} 
              className="inline-flex items-center gap-3 px-8 py-4 bg-brand-blue text-white rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-brand-blue hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <CornerUpLeft size={18} /> Reply via Email
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}

// Next.js Suspense Wrapper for searchParams
export default function InquiriesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen bg-white"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>}>
      <InquiryDetail />
    </Suspense>
  );
}