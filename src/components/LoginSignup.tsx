/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { UserSession } from "../types";
import { MailIcon, LockIcon, PersonIcon, ArrowRightIcon } from "./Icons";
import BrandLogo from "./BrandLogo";
import { getSupabaseClient, buildUserSession } from "../lib/supabaseClient";

interface LoginSignupProps {
  onLoginSuccess: (session: UserSession) => void;
}

export default function LoginSignup({ onLoginSuccess }: LoginSignupProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const client = getSupabaseClient();

    // Supabase가 활성화되지 않은 경우 기존 Mock 모드로 동작합니다.
    if (!client) {
      console.warn("Supabase client is not active. Falling back to Mock authentication.");
      if (isLogin) {
        if (!email.trim() || !password.trim()) {
          setError("이메일과 비밀번호를 입력해주세요.");
          return;
        }
        const mockSession: UserSession = {
          id: "user-123",
          email: email,
          name: email.split("@")[0] || "여행자",
          userSeq: 1,
          avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBCJRKcrw8jYy6nRr-YP0mvfcdQCZGulGdyzi2gnMfUv5adXdsvwJ-c6la6y17w3AVwz4CqHMb-ZOdjLMlclo8dS8bpakpQFAZ9V3DJZOctvzYBXd1rQF045DpAAel7e2tvMbOyA_iREPNt2Z0KfV9wRfJI6LpNzyocB3j3Zr2VyvTf6bHPZCwVk1J5MmxTf3rT476oiTNPeJV9KJ5atyNQRlm2I2gVLZU8rTcbp9flnrLAClH3tub8DCtmZGU2Ef9nAUcyb-PfuaU"
        };
        localStorage.setItem("tripmate_session", JSON.stringify(mockSession));
        onLoginSuccess(mockSession);
      } else {
        if (!name.trim() || !email.trim() || password.length < 8) {
          setError("입력 정보를 다시 확인해주세요.");
          return;
        }
        const mockSession: UserSession = {
          id: "user-123",
          email: email,
          name: name,
          userSeq: 1,
          avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBCJRKcrw8jYy6nRr-YP0mvfcdQCZGulGdyzi2gnMfUv5adXdsvwJ-c6la6y17w3AVwz4CqHMb-ZOdjLMlclo8dS8bpakpQFAZ9V3DJZOctvzYBXd1rQF045DpAAel7e2tvMbOyA_iREPNt2Z0KfV9wRfJI6LpNzyocB3j3Zr2VyvTf6bHPZCwVk1J5MmxTf3rT476oiTNPeJV9KJ5atyNQRlm2I2gVLZU8rTcbp9flnrLAClH3tub8DCtmZGU2Ef9nAUcyb-PfuaU"
        };
        localStorage.setItem("tripmate_session", JSON.stringify(mockSession));
        onLoginSuccess(mockSession);
      }
      return;
    }

    try {
      if (isLogin) {
        if (!email.trim() || !password.trim()) {
          setError("이메일과 비밀번호를 입력해주세요.");
          return;
        }

        // Supabase Auth 로그인 시도
        const { data, error: authErr } = await client.auth.signInWithPassword({
          email,
          password
        });

        if (authErr) throw authErr;

        if (data?.user) {
          // public.users 테이블에서 해당 유저의 user_seq 정보 조회 (없으면 생성까지 처리)
          const built = await buildUserSession(client, data.user);

          const sessionData: UserSession = {
            ...built,
            avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBCJRKcrw8jYy6nRr-YP0mvfcdQCZGulGdyzi2gnMfUv5adXdsvwJ-c6la6y17w3AVwz4CqHMb-ZOdjLMlclo8dS8bpakpQFAZ9V3DJZOctvzYBXd1rQF045DpAAel7e2tvMbOyA_iREPNt2Z0KfV9wRfJI6LpNzyocB3j3Zr2VyvTf6bHPZCwVk1J5MmxTf3rT476oiTNPeJV9KJ5atyNQRlm2I2gVLZU8rTcbp9flnrLAClH3tub8DCtmZGU2Ef9nAUcyb-PfuaU"
          };

          localStorage.setItem("tripmate_session", JSON.stringify(sessionData));
          onLoginSuccess(sessionData);
        }
      } else {
        if (!name.trim()) {
          setError("성함을 입력해주세요.");
          return;
        }
        if (!email.trim()) {
          setError("이메일을 입력해주세요.");
          return;
        }
        if (password.length < 8) {
          setError("비밀번호는 8자 이상이어야 합니다.");
          return;
        }
        if (password !== confirmPassword) {
          setError("비밀번호가 일치하지 않습니다.");
          return;
        }
        if (!agreeTerms) {
          setError("서비스 이용약관 및 개인정보 처리방침에 동의해주세요.");
          return;
        }

        // Supabase Auth 회원가입 시도 (이름 정보 메타데이터 추가 전송)
        const { data, error: authErr } = await client.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name
            }
          }
        });

        if (authErr) throw authErr;

        if (data?.user) {
          // 1. public.profiles 테이블 업서트 (중복 충돌 우회 및 eamil 칼럼 오타 준수)
          const { error: profileErr } = await client
            .from("profiles")
            .upsert({
              id: data.user.id,
              full_name: name,
              eamil: email, // profiles 테이블 오타 칼럼명 적용
              avatar_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBCJRKcrw8jYy6nRr-YP0mvfcdQCZGulGdyzi2gnMfUv5adXdsvwJ-c6la6y17w3AVwz4CqHMb-ZOdjLMlclo8dS8bpakpQFAZ9V3DJZOctvzYBXd1rQF045DpAAel7e2tvMbOyA_iREPNt2Z0KfV9wRfJI6LpNzyocB3j3Zr2VyvTf6bHPZCwVk1J5MmxTf3rT476oiTNPeJV9KJ5atyNQRlm2I2gVLZU8rTcbp9flnrLAClH3tub8DCtmZGU2Ef9nAUcyb-PfuaU"
            });

          if (profileErr) {
            console.error("Profile creation error:", profileErr);
          }

          // 2. public.users 테이블 업서트 (user_id 기준 중복 키 위반 예방)
          const { data: newUserRow, error: userErr } = await client
            .from("users")
            .upsert({
              user_id: data.user.id,
              login_email: email,
              name: name,
              last_login_time: new Date().toISOString()
            }, { onConflict: "user_id" })
            .select()
            .single();

          if (userErr) {
            throw userErr;
          }

          const sessionData: UserSession = {
            id: data.user.id,
            email: email,
            name: name,
            userSeq: newUserRow?.user_seq ? Number(newUserRow.user_seq) : 1,
            avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBCJRKcrw8jYy6nRr-YP0mvfcdQCZGulGdyzi2gnMfUv5adXdsvwJ-c6la6y17w3AVwz4CqHMb-ZOdjLMlclo8dS8bpakpQFAZ9V3DJZOctvzYBXd1rQF045DpAAel7e2tvMbOyA_iREPNt2Z0KfV9wRfJI6LpNzyocB3j3Zr2VyvTf6bHPZCwVk1J5MmxTf3rT476oiTNPeJV9KJ5atyNQRlm2I2gVLZU8rTcbp9flnrLAClH3tub8DCtmZGU2Ef9nAUcyb-PfuaU"
          };

          localStorage.setItem("tripmate_session", JSON.stringify(sessionData));
          alert("성공적으로 회원가입이 완료되었습니다!");
          onLoginSuccess(sessionData);
        }
      }
    } catch (err: any) {
      console.error("Auth submit logic error:", err);
      setError(err.message || "인증 처리 중 알 수 없는 오류가 발생했습니다.");
    }
  };

  return (
    <div className="w-full max-w-[440px] mx-auto py-12 px-6 flex flex-col items-center">
      {/* Logo Header */}
      <header className="mb-8 text-center flex flex-col items-center gap-2">
        <h1 className="flex items-center justify-center select-none">
          <BrandLogo size="lg" />
        </h1>
        <p className="font-body-md text-on-surface-variant text-sm">
          {isLogin ? "여행의 설렘을 AI와 함께" : "스마트한 여행의 시작, 트립메이트 AI와 함께하세요"}
        </p>
      </header>

      {/* Main Login / Signup Card */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/30">
        <h2 className="font-headline-md text-headline-md mb-6 text-on-surface">
          {isLogin ? "로그인" : "계정 만들기"}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-error-container/30 border border-error-container/50 rounded-lg text-error text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field (Sign Up Only) */}
          {!isLogin && (
            <div className="space-y-1">
              <label className="font-label-md text-label-md text-on-surface-variant block text-xs" htmlFor="name">
                이름
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5 flex items-center justify-center">
                  <PersonIcon className="w-4 h-4" />
                </span>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-surface-container-low border-0 rounded-lg text-body-md focus:ring-2 focus:ring-primary-container focus:bg-white transition-all outline-none"
                  placeholder="성함을 입력하세요"
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-1">
            <label className="font-label-md text-label-md text-on-surface-variant block text-xs" htmlFor="email">
              이메일 주소
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5 flex items-center justify-center">
                <MailIcon className="w-4 h-4" />
              </span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 pl-12 pr-4 bg-surface-container-low border-0 rounded-lg text-body-md focus:ring-2 focus:ring-primary-container focus:bg-white transition-all outline-none"
                placeholder="이메일 주소를 입력하세요"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="font-label-md text-label-md text-on-surface-variant text-xs" htmlFor="password">
                비밀번호
              </label>
              {isLogin && (
                <button
                  type="button"
                  className="font-label-sm text-label-sm text-primary hover:underline bg-transparent border-0 cursor-pointer"
                >
                  비밀번호를 잊으셨나요?
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5 flex items-center justify-center">
                <LockIcon className="w-4 h-4" />
              </span>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-12 pr-4 bg-surface-container-low border-0 rounded-lg text-body-md focus:ring-2 focus:ring-primary-container focus:bg-white transition-all outline-none"
                placeholder={isLogin ? "비밀번호를 입력하세요" : "8자 이상 입력하세요"}
              />
            </div>
          </div>

          {/* Confirm Password Field (Sign Up Only) */}
          {!isLogin && (
            <div className="space-y-1">
              <label className="font-label-md text-label-md text-on-surface-variant block text-xs" htmlFor="confirmPassword">
                비밀번호 확인
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5 flex items-center justify-center">
                  <LockIcon className="w-4 h-4" />
                </span>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-surface-container-low border-0 rounded-lg text-body-md focus:ring-2 focus:ring-primary-container focus:bg-white transition-all outline-none"
                  placeholder="비밀번호를 다시 입력하세요"
                />
              </div>
            </div>
          )}

          {/* Terms of Service (Sign Up Only) */}
          {!isLogin && (
            <div className="flex items-start gap-2 pt-2">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary-container cursor-pointer"
                />
              </div>
              <label htmlFor="terms" className="font-label-sm text-label-sm text-on-surface-variant select-none cursor-pointer leading-tight">
                <span className="text-primary hover:underline">서비스 이용약관</span> 및{" "}
                <span className="text-primary hover:underline">개인정보 처리방침</span>에 동의합니다.
              </label>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            type="submit"
            className="w-full h-14 bg-primary-container text-on-primary-container font-headline-md text-headline-md rounded-xl hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-6 cursor-pointer border-none shadow-[0_4px_12px_rgba(0,102,255,0.2)]"
          >
            {isLogin ? "로그인" : "계정 생성하기"}
            {!isLogin && <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

      </div>

      {/* Toggle View Footer */}
      <footer className="text-center mt-6">
        <p className="font-body-md text-sm text-on-surface-variant">
          {isLogin ? "아직 계정이 없으신가요? " : "이미 계정이 있으신가요? "}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary font-bold hover:underline ml-1 bg-transparent border-0 cursor-pointer text-sm"
          >
            {isLogin ? "회원가입" : "로그인"}
          </button>
        </p>
      </footer>
    </div>
  );
}
