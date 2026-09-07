'use client';

import { useEffect, useRef } from 'react';
import { logoutAction } from '@/app/actions/auth';

const IDLE_TIMEOUT_MS = 60 * 60 * 1000; 

const CHECK_INTERVAL_MS = 5000; 

export default function SessionTimeout({ children }: { children: React.ReactNode }) {
  // Prevents "infinite loop" during the kickout process
  const isLoggingOutRef = useRef<boolean>(false); 

  useEffect(() => {
    if (window.location.pathname === '/admin') {
      return; 
    }

    // 1. Initialize activity tracker on login
    if (!localStorage.getItem('last_admin_activity')) {
      localStorage.setItem('last_admin_activity', Date.now().toString());
    }

    // 2. The Kickout Execution
    const executeKickout = async () => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      console.log("Session expired due to inactivity! Executing Signout...");
      
      // Wipe the activity tracking so it resets on next login
      localStorage.removeItem('last_admin_activity');

      try {
        // Destroy the secure cookie on the server
        await logoutAction();
      } catch (err) {
        console.error("Logout action failed", err);
      }
      
      // Throw them out to the login page with the expired flag
      window.location.href = '/admin?expired=true';
    };

    // 3. Activity Tracker (Throttled to keep performance lightning fast)
    let throttleTimer: NodeJS.Timeout | null = null;
    const updateActivity = () => {
      // We only update local storage once per second to prevent browser lag
      if (throttleTimer) return;
      
      throttleTimer = setTimeout(() => {
        localStorage.setItem('last_admin_activity', Date.now().toString());
        throttleTimer = null;
      }, 1000); 
    };

    // 4. The Background Watchdog
    const checkInactivity = () => {
      if (isLoggingOutRef.current) return;
      
      const lastActivityStr = localStorage.getItem('last_admin_activity');
      if (!lastActivityStr) return;

      const lastActivity = parseInt(lastActivityStr, 10);
      const timeSinceLastActivity = Date.now() - lastActivity;

      // If the time since their last mouse movement is greater than our limit, KICK THEM.
      if (timeSinceLastActivity >= IDLE_TIMEOUT_MS) {
        executeKickout();
      }
    };

    // Listen for ANY sign of life from the admin
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Check the clock every 10 seconds
    const intervalId = setInterval(checkInactivity, CHECK_INTERVAL_MS);

    // Instantly check the clock if they minimized the browser and came back
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
         checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // --- CLEANUP ---
    return () => {
      activityEvents.forEach(event => document.removeEventListener(event, updateActivity));
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, []);

  return <>{children}</>;
}