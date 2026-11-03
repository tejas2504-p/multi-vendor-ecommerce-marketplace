import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4">
        <p>© 2026 NexusMarket. Production-Grade Multi-Vendor Architecture.</p>
        <div className="flex space-x-6">
          <span>React 18 + TS</span>
          <span>•</span>
          <span>Node.js Express + TS</span>
          <span>•</span>
          <span>MongoDB & Redis</span>
          <span>•</span>
          <span>Elasticsearch</span>
        </div>
      </div>
    </footer>
  );
};

