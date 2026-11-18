"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { useClientMeta } from "./ClientLayoutShell";

const GOOGLE_PRESET_PROFILES = [
  {
    fullName: "Nguyễn Minh Anh",
    email: "minhanh.google@gmail.com",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=85",
  },
  {
    fullName: "Trần Quốc Bảo",
    email: "quocbao.travel@gmail.com",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=85",
  },
];

function GoogleLogo() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

export function SocialOAuthButtons({
  redirectTo = "/account/orders",
  initialSandboxProvider = null,
}: {
  redirectTo?: string;
  initialSandboxProvider?: "google" | null;
}) {
  const router = useRouter();
  const { setCurrentUser } = useClientMeta();

  const [redirecting, setRedirecting] = useState(false);
  const [showSandboxModal, setShowSandboxModal] = useState(
    initialSandboxProvider === "google"
  );
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialSandboxProvider === "google") {
      setShowSandboxModal(true);
    }
  }, [initialSandboxProvider]);

  /**
   * Direct single-hop navigation to `/api/client/auth/oauth/google` avoids a redundant JSON
   * preflight fetch before hitting Google's OAuth consent endpoint. When OAuth keys are unset
   * in local dev, that endpoint redirects cleanly back with `?oauth_sandbox=google`.
   */
  function handleGoogleLogin() {
    setError("");
    setRedirecting(true);
    window.location.href = `/api/client/auth/oauth/google?next=${encodeURIComponent(
      redirectTo
    )}`;
  }

  async function submitSandboxLogin(profile: {
    fullName: string;
    email: string;
    avatar?: string;
  }) {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/client/auth/oauth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: profile.fullName,
          email: profile.email,
          avatar: profile.avatar || null,
          providerId: `google-${profile.email}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Đăng nhập thất bại");
        return;
      }
      setCurrentUser(data.user);
      setShowSandboxModal(false);
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative flex items-center py-1">
        <div className="flex-1 border-t border-[#ECECEC]" />
        <span className="px-3 text-[12px] font-medium text-[#667479]">
          Hoặc tiếp tục với
        </span>
        <div className="flex-1 border-t border-[#ECECEC]" />
      </div>

      {error && !showSandboxModal && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 text-[#DA0808] text-[12px] px-3 py-2 font-medium"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={redirecting}
        onClick={handleGoogleLogin}
        className="w-full h-[46px] px-4 rounded-[10px] border border-[#CCD1D2] bg-white hover:bg-[#F6F6F6] hover:border-[#4502C7]/45 text-[#25282B] text-[14px] font-semibold inline-flex items-center justify-center gap-2.5 transition-colors disabled:opacity-60"
      >
        {redirecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <GoogleLogo />
        )}
        <span>Đăng nhập bằng Google</span>
      </button>

      {/* Local fallback chooser modal only shown when GOOGLE_CLIENT_ID/SECRET are unconfigured */}
      {showSandboxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="oauth-sandbox-title"
            className="w-full max-w-md bg-white rounded-[16px] shadow-2xl border border-[#ECECEC] overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[#ECECEC] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <GoogleLogo />
                <h3
                  id="oauth-sandbox-title"
                  className="text-[16px] font-bold text-[#25282B]"
                >
                  Đăng nhập bằng Google
                </h3>
              </div>
              <button
                type="button"
                aria-label="Đóng cửa sổ"
                onClick={() => {
                  setShowSandboxModal(false);
                  setError("");
                }}
                className="p-1 text-[#667479] hover:text-[#25282B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-[12px] text-[#667479] bg-[#F6F6F6] rounded-[8px] px-3 py-2">
                Chế độ OAuth Sandbox (hệ thống tự chuyển sang Google OAuth 2.0
                chính thức khi cấu hình <code>GOOGLE_CLIENT_ID</code> &amp;{" "}
                <code>GOOGLE_CLIENT_SECRET</code>). Chọn nhanh một tài khoản
                để tiếp tục:
              </p>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg bg-red-50 border border-red-200 text-[#DA0808] text-[12px] px-3 py-2 font-medium"
                >
                  {error}
                </div>
              )}

              <div className="space-y-2">
                {GOOGLE_PRESET_PROFILES.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={submitting}
                    onClick={() => submitSandboxLogin(acc)}
                    className="w-full flex items-center gap-3 p-3 rounded-[10px] border border-[#ECECEC] hover:border-[#4502C7] hover:bg-[#4502C7]/5 text-left transition-colors disabled:opacity-60"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={acc.avatar}
                      alt={acc.fullName}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-[#25282B] truncate">
                        {acc.fullName}
                      </p>
                      <p className="text-[12px] text-[#667479] truncate">
                        {acc.email}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitSandboxLogin({
                    fullName: customName,
                    email: customEmail,
                  });
                }}
                className="pt-3 border-t border-[#ECECEC] space-y-2.5"
              >
                <p className="text-[12px] font-semibold text-[#25282B]">
                  Hoặc nhập tài khoản Google khác:
                </p>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Họ và tên (vd: Lê Quang Hải)"
                  className="w-full h-[38px] px-3 rounded-[8px] border border-[#CCD1D2] text-[13px] focus:outline-none focus:border-[#4502C7]"
                />
                <input
                  type="email"
                  required
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="Email Google"
                  className="w-full h-[38px] px-3 rounded-[8px] border border-[#CCD1D2] text-[13px] focus:outline-none focus:border-[#4502C7]"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-[40px] rounded-[8px] bg-[#4502C7] hover:bg-[#36019e] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Tiếp tục
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
