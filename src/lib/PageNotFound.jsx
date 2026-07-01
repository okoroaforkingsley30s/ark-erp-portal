import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function PageNotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0b1f5e] flex items-center justify-center p-6">
      <div className="max-w-xl w-full rounded-3xl bg-[#102969] border border-white/10 shadow-2xl p-8 text-center">
        <div className="text-6xl mb-4">🤖</div>

        <h1 className="text-3xl font-bold text-white mb-4">Oops!</h1>

        <p className="text-blue-100 mb-4">I searched everywhere...</p>

        <div className="space-y-2 text-blue-50 mb-6">
          <p>✔ Under the servers</p>
          <p>✔ Behind the printers</p>
          <p>✔ Inside the ATM</p>
        </div>

        <p className="text-blue-100 mb-2">I couldn&apos;t find this page.</p>

        <p className="text-blue-100 mb-8">
          Let&apos;s get you back to work before your supervisor notices. 😄
        </p>

        <Button
          onClick={() => navigate("/")}
          className="bg-[#ff5a00] hover:bg-[#e24f00] text-white px-6"
        >
          🏠 Return to Dashboard
        </Button>
      </div>
    </div>
  );
}