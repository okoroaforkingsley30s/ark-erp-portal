import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CircleDot, ArrowLeft } from 'lucide-react';

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969] p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6">
          <CircleDot className="w-9 h-9 text-primary-foreground" />
        </div>
        <h1 className="text-6xl font-bold text-primary mb-2">404</h1>
        <p className="text-lg font-semibold mb-1">Page Not Found</p>
        <p className="text-sm text-muted-foreground mb-6">
          The page you're looking for doesn't exist in the ARK ONE Portal.
        </p>
        <Link to="/">
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}