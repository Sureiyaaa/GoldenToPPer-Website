// admin/hooks/useRBAC.ts
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCustomSession, getRBACProfile } from '@/app/actions/auth'; 

export function useRBAC(moduleCode: string) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoadingRBAC, setIsLoadingRBAC] = useState(true);
  const [permissions, setPermissions] = useState({ can_view: false, can_create: false, can_edit: false, can_delete: false });
  const router = useRouter();

  useEffect(() => {
    const verifyAccess = async () => {
      try {
        const userId = await getCustomSession();
        
        if (!userId) {
          router.replace('/admin');
          return;
        }

        // Securely fetch profile from the backend
        const rbac = await getRBACProfile();

        if (!rbac || !rbac.permissions) {
          router.replace('/admin/dashboard'); 
          return;
        }

        if (rbac.permissions === 'SUPER_ADMIN') {
          setPermissions({ can_view: true, can_create: true, can_edit: true, can_delete: true });
          setIsAuthorized(true);
          setIsLoadingRBAC(false);
          return;
        }

        const perms = rbac.permissions as Record<string, any>;
        const targetModule = perms[moduleCode];

        if (targetModule && targetModule.can_view) {
          setPermissions({
            can_view: targetModule.can_view,
            can_create: targetModule.can_create,
            can_edit: targetModule.can_edit,
            can_delete: targetModule.can_delete
          });
          setIsAuthorized(true);
        } else {
          router.replace('/admin/dashboard');
        }
      } catch (error) {
        console.error("RBAC Error:", error);
        router.replace('/admin');
      } finally {
        setIsLoadingRBAC(false);
      }
    };

    verifyAccess();
  }, [moduleCode, router]);

  return { isAuthorized, isLoadingRBAC, permissions };
}