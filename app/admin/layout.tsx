import SessionTimeout from './components/sessiontimeout'; 

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionTimeout>
      <div className="admin-global-wrapper">
        {children} 
      </div>
    </SessionTimeout>
  );
}