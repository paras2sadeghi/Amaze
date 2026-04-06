import React, { useState, useEffect } from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export default function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      setHasError(true);
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(error.error?.message || "");
        if (parsed.error) message = `Firestore Error: ${parsed.error}`;
      } catch {
        message = error.error?.message || error.message || message;
      }
      setErrorMessage(message);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      setHasError(true);
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(event.reason?.message || "");
        if (parsed.error) message = `Firestore Error: ${parsed.error}`;
      } catch {
        message = event.reason?.message || String(event.reason) || message;
      }
      setErrorMessage(message);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (hasError) {
    return (
      <div className="fixed inset-0 z-[300] bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-6">
          <h2 className="text-3xl font-black text-red-500 tracking-tighter uppercase">Critical Error</h2>
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-slate-400 font-mono text-sm break-words">
            {errorMessage}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white text-slate-950 rounded-xl font-black tracking-widest active:scale-95 transition-transform"
          >
            REBOOT SYSTEM
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
