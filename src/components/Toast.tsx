/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  // onClose가 부모 리렌더링마다 새로 생성되는 인라인 함수여도 타이머가 리셋되지
  // 않도록, 최신 콜백은 ref로 추적하고 타이머 자체는 마운트 시 1회만 예약한다.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), 3000);
    return () => clearTimeout(timer);
  }, []);

  const isSuccess = type === "success";

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[2000] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
      <div
        className={`flex items-center gap-2.5 px-5 py-3.5 rounded-xl shadow-lg border bg-white pointer-events-auto ${
          isSuccess ? "border-primary/25" : "border-error/25"
        }`}
      >
        <span
          className={`material-symbols-outlined text-lg ${
            isSuccess ? "text-primary" : "text-error"
          }`}
        >
          {isSuccess ? "check_circle" : "error"}
        </span>
        <span className="text-sm font-bold text-on-surface">{message}</span>
      </div>
    </div>
  );
}
