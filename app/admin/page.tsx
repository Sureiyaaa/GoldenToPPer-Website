// app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import PageTransition from '@/app/components/page-transitions';

// FIX #1: Correct import path
import { loginAction } from '@/app/actions/auth'; 

export default function AdminLogin() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false); 
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('expired') === 'true') {
      setErrorMsg('Your session has expired. Please log in again.');
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const formDataObj = new FormData();
      formDataObj.append('username', formData.username);
      formDataObj.append('password', formData.password);

      const result = await loginAction(formDataObj);

      if (result?.error) {
        setErrorMsg(result.error); 
        setIsLoading(false);
      } else if (result?.success) {
        window.history.replaceState(null, '', '/admin');
        router.push('/admin/dashboard');
      } else {
        setErrorMsg("Unexpected response from server.");
        setIsLoading(false);
      }
    } catch (err: any) {
      // FIX #2: This catches server crashes so the UI stops loading and shows the error!
      console.error("Login Error:", err);
      setErrorMsg("Server connection failed. Please check the VS Code terminal for compilation errors.");
      setIsLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="relative min-h-screen w-full flex items-center justify-center font-sans selection:bg-brand-blue selection:text-white px-4 sm:px-6 lg:px-8 overflow-hidden">
        
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0">
          <source src="/images/admin_bg.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 z-0 backdrop-blur-[3px]" />

        <div className="max-w-md w-full relative z-10">
          <div className="bg-white py-10 px-6 shadow-2xl rounded-2xl border border-white/20 sm:px-10 relative">
            
            <Link href="/" className="absolute top-6 left-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-brand-blue transition-colors outline-none">
              <ArrowLeft size={16} /> Back
            </Link>

            <div className="text-center mt-6">
              <Image src="/images/admin/GoldenTopperlogo.svg" alt="Golden Topper" width={180} height={50} className="mx-auto drop-shadow-sm" />
              <h2 className="mt-6 text-2xl font-serif text-brand-blue tracking-tight">Admin Portal</h2>
              <p className="mt-2 text-sm text-gray-500">Sign in to access the management dashboard</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6 mt-8">
              
              {errorMsg && (
                <div className="bg-red-50 p-4 rounded-md border border-red-200">
                  <p className="text-sm font-bold text-red-600">{errorMsg}</p>
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-brand-blue mb-1.5">Username</label>
                <div className="relative">
                  <input 
                    type="text" name="username" id="username" required 
                    value={formData.username} onChange={handleInputChange} 
                    className="appearance-none bg-white block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue sm:text-sm transition-colors" 
                    placeholder="Enter your username" 
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-brand-blue mb-1.5">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} name="password" id="password" required 
                    value={formData.password} onChange={handleInputChange} 
                    className="appearance-none bg-white block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue sm:text-sm transition-colors pr-12" 
                    placeholder="••••••••" 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-blue transition-colors outline-none">
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold tracking-wider uppercase text-white bg-brand-blue hover:bg-brand-blue focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:opacity-70 disabled:cursor-not-allowed transition-all">
                  {isLoading ? 'Authenticating...' : 'Sign In'}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}