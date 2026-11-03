import React from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { useApp } from '../context/AppContext';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRole, setActiveRole } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased selection:bg-indigo-500 selection:text-white">
      <Navbar activeRole={activeRole} onRoleChange={setActiveRole} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
};

