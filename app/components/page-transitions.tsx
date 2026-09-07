'use client';

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    // 1. mode="wait" ensures the old page completely disappears BEFORE the new page loads.
    // 2. onExitComplete fires the exact millisecond the old page is gone, instantly snapping the browser scroll to the top.
    <AnimatePresence 
      mode="wait" 
      onExitComplete={() => {
        window.scrollTo(0, 0);
        setTimeout(() => window.scrollTo(0, 0), 10); // Gives the new page 10ms to calculate its height!
      }}
    >
      <motion.div
        key={pathname} // 3. This key forces the animation to trigger every time the URL changes.
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }} // 4. An exit state is required for onExitComplete to fire!
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}