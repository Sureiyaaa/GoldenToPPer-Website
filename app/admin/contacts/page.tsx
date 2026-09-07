'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, UserCircle2, CornerUpLeft, Loader2, Calendar, Mail, Phone } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

function ContactDetail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id'); // Grabs ?id=123 from the URL
  const [contact, setContact] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    const fetchContact = async () => {
      const { data } = await supabase
        .from('contact')
        .select(`id, created_at, is_read, "type of inquiry", message, client (first_name, last_name, email, phone_number)`)
        .eq('id', id)
        .single();
        
      if (data) {
        // 1. FIX: Normalize Supabase returning arrays for foreign keys
        const clientData = Array.isArray(data.client) ? data.client[0] : data.client;

        setContact({
          ...data,
          client: clientData
        });

        // 2. FIX: Automatically mark as read if visited directly
        if (!data.is_read) {
          await supabase.from('contact').update({ is_read: true }).eq('id', id);
        }
      }
      setIsLoading(false);
    };
    
    fetchContact();
  }, [id, supabase]);

  if (isLoading) return <div className="flex justify-center items-center min-h-screen bg-white"><Loader2 className="animate-spin text-[#142f72]" size={32} /></div>;
  if (!contact) return <div className="min-h-screen bg-white flex flex-col justify-center items-center text-gray-500"><p className="mb-4">Message not found.</p><button onClick={() => router.push('/admin/dashboard')} className="text-[#142f72] font-bold hover:underline">Return to Dashboard</button></div>;

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col w-full">
      
      {/* 1. FULL WIDTH STICKY TOOLBAR */}
      <div className="w-full border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-10 px-6 sm:px-10 py-4 flex items-center justify-between">
        <button onClick={() => router.push('/admin/dashboard')} className="flex items-center gap-3 text-gray-500 hover:text-[#142f72] font-semibold text-sm transition-colors group outline-none">
          <span className="p-2 bg-gray-50 group-hover:bg-[#142f72]/10 rounded-full transition-colors">
            <ArrowLeft size={18} />
          </span>
          Back to Dashboard
        </button>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
          <Calendar size={14} />
          {new Date(contact.created_at).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>

      {/* 2. FULL WIDTH CONTENT AREA WITH PADDING */}
      <div className="w-full px-6 sm:px-12 lg:px-20 py-12 flex-1">
        
        {/* Massive Impactful Header */}
        <div className="mb-12">
          <span className="inline-block px-3 py-1 bg-[#f8f9fa] text-[#142f72] rounded-md text-[10px] font-bold tracking-widest uppercase mb-4 border border-gray-200">
            {contact["type of inquiry"]}
          </span>
          <h1 className="text-4xl md:text-5xl font-serif text-[#142f72] leading-tight">
            New message from {contact.client?.first_name}
          </h1>
        </div>

        {/* Full-width Sender Info Row */}
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between border-y border-gray-100 py-6 mb-12 gap-6">
          <div className="flex items-center gap-5">
            <UserCircle2 size={56} className="text-gray-200" strokeWidth={1} />
            <div>
              <div className="text-xl font-medium text-gray-900 mb-1">
                {contact.client?.first_name} {contact.client?.last_name}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1.5"><Mail size={14} className="text-gray-400"/> {contact.client?.email}</span>
                <span className="flex items-center gap-1.5"><Phone size={14} className="text-gray-400"/> {contact.client?.phone_number || 'No phone provided'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. CONSTRAINED MESSAGE AREA (For Readability) */}
        <div className="max-w-[85ch]">
          <div className="text-lg text-gray-800 leading-loose whitespace-pre-wrap">
            {contact.message}
          </div>

          {/* Action Button */}
          <div className="mt-16 pt-8 border-t border-gray-100">
            <a 
              href={`mailto:${contact.client?.email}?subject=RE: ${contact["type of inquiry"]}`} 
              className="inline-flex items-center gap-3 px-8 py-4 bg-[#142f72] text-white rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-[#152856] hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
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
export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen bg-white"><Loader2 className="animate-spin text-[#142f72]" size={40} /></div>}>
      <ContactDetail />
    </Suspense>
  );
}