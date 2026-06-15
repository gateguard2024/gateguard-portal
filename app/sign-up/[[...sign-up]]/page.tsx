import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0C0F14]">
      <div className="flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-sm.png" alt="GateGuard" className="w-10 h-10 object-contain" />
          <div>
            <p className="text-white font-bold text-lg tracking-wide leading-none">GateGuard</p>
            <p className="text-[#6B7EFF]/80 text-[11px] font-medium tracking-widest uppercase">Dealer OS</p>
          </div>
        </div>
        <SignUp
          fallbackRedirectUrl="/"
          signInFallbackRedirectUrl="/sign-in"
          appearance={{
            variables: {
              colorPrimary: "#6B7EFF",
              colorBackground: "#161B26",
              colorText: "#F0F4FF",
              colorTextSecondary: "#8A95B0",
              colorInputBackground: "#1E2535",
              colorInputText: "#F0F4FF",
              borderRadius: "0.75rem",
            },
          }}
        />
      </div>
    </div>
  );
}
