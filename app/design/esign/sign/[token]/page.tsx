"use client";
import { useState, useRef } from "react";
import { Check, X } from "lucide-react";

// ─── Signature Canvas Hook ────────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignPage({ params }: { params: { token: string } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [signed, setSigned] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasStrokes(true);
  }

  function stopDraw() {
    isDrawing.current = false;
  }

  function clearSig() {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasStrokes(false);
  }

  function handleSign() {
    if (!hasStrokes) return;
    setSigned(true);
  }

  // Touch support
  function handleTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !e.touches[0]) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
  }

  function handleTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !e.touches[0]) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    ctx.lineTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasStrokes(true);
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Document Signed</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your signature has been captured. A copy will be sent to your email.
          </p>
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-400 font-mono">
            Token: {params.token}
          </div>
          <div className="mt-6 text-[10px] text-gray-300">
            GateGuard · portal.gateguard.co
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-[#0B1728] px-6 py-4">
          <div className="text-base font-black tracking-[0.15em] uppercase text-[#6B7EFF]">NEXUS</div>
          <div className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/40 mt-0.5">by GateGuard · Document Signing</div>
        </div>

        <div className="p-6 space-y-5">
          {/* Document summary */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Document Details</div>
            <div className="text-sm font-semibold text-gray-900">GateGuard Document</div>
            <div className="text-xs text-gray-500 mt-0.5">Sent for your review and signature</div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200">
              <div className="text-[10px] text-gray-400">From</div>
              <div className="text-xs font-medium text-gray-700">GateGuard · rfeldman@gateguard.co</div>
            </div>
          </div>

          {/* Signature area */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Signature</div>
            <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50 relative">
              <canvas
                ref={canvasRef}
                width={500}
                height={200}
                className="w-full touch-none cursor-crosshair"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={stopDraw}
                style={{ display: 'block' }}
              />
              {!hasStrokes && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-gray-300 text-sm font-medium">Sign here</span>
                </div>
              )}
            </div>
            <button onClick={clearSig} className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline">
              Clear signature
            </button>
          </div>

          {/* Legal text */}
          <p className="text-[10px] text-gray-400 leading-relaxed">
            By clicking "Sign &amp; Complete" you agree that your electronic signature is legally equivalent to your handwritten signature on this document.
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5">
              <X size={14} /> Decline
            </button>
            <button
              onClick={handleSign}
              disabled={!hasStrokes}
              className="flex-1 py-3 bg-[#6B7EFF] text-white rounded-xl text-sm font-semibold hover:bg-[#5a6ee8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Check size={14} /> Sign &amp; Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
