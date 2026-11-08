/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { TravelPlan } from "../../types";

interface FeedbackMessage {
  role: "user" | "ai";
  text: string;
}

interface FeedbackPanelProps {
  plan: TravelPlan;
  // 수정된 일정을 부모 상태에 반영한다. 저장 모드면 서버 저장까지 기다린다.
  onPlanRevised: (plan: TravelPlan) => Promise<void>;
  onShowToast?: (message: string, type: "success" | "error") => void;
}

// 서버 예산 25초(TOTAL_BUDGET_MS)에 의도 분류·사진 첨부가 더 붙는다. 그보다 여유를 두되
// 무한정 기다리지는 않는다.
const REVISE_TIMEOUT_MS = 35_000;

// 자연어 피드백 채팅 — "맛집 위주로 바꿔줘" 같은 요청을 Gemini에 보내 일정 재생성
export default function FeedbackPanel({ plan, onPlanRevised, onShowToast }: FeedbackPanelProps) {
  const [feedbackMessages, setFeedbackMessages] = useState<FeedbackMessage[]>([]);
  const [feedbackInput, setFeedbackInput] = useState("");
  const [isRevising, setIsRevising] = useState(false);

  const handleSendFeedback = async () => {
    const text = feedbackInput.trim();
    if (!text || isRevising) return;

    setFeedbackMessages((prev) => [...prev, { role: "user", text }]);
    setFeedbackInput("");
    setIsRevising(true);

    // 서버 예산 25초에 의도 분류와 사진 첨부가 더 붙는다. 그보다 넉넉히 잡되,
    // 응답이 영영 안 와도 입력창이 잠긴 채 남지 않도록 상한을 둔다.
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), REVISE_TIMEOUT_MS);

    try {
      const res = await fetch("/api/revise-plan", {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: plan.destination,
          startDate: plan.startDate,
          endDate: plan.endDate,
          budget: plan.budget,
          companion: plan.companion,
          intensity: plan.intensity,
          transportMode: plan.transportMode,
          styles: plan.styles,
          mustVisitPlaces: plan.mustVisitPlaces,
          planContent: plan.planContent,
          feedback: text,
        }),
      });
      const data = await res.json();

      if (data.success && Array.isArray(data.planContent)) {
        // 서버가 준 narrationDegraded를 그대로 반영한다. 안 읽으면 이전 값이 남는다.
        const degraded = data.narrationDegraded === true;
        const updatedPlan = { ...plan, planContent: data.planContent, narrationDegraded: degraded };
        // 부모의 상태 반영은 호출 즉시 실행되고, 저장 모드의 서버 저장만 아래에서 기다린다.
        const applying = onPlanRevised(updatedPlan);

        // 서버가 무엇을 실제로 반영했는지 그대로 전한다. 비어 있는데 "수정했다"고 하면
        // 사용자는 자기 요청이 무시된 걸 알 방법이 없다.
        const applied: string[] = Array.isArray(data.applied) ? data.applied : [];
        setFeedbackMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: applied.length > 0
              ? `${applied.join(", ")}을(를) 반영해 일정을 다시 짰어요. 아래 내용을 확인해보세요.`
              : "그 요청은 아직 일정 조건으로 옮기지 못해서 장소만 다시 골랐어요. 지금 바꿀 수 있는 건 일정 강도(여유롭게·빡빡하게), 이동수단, 취향, 특정 장소 추가·제외예요.",
          },
        ]);
        await applying;
        // 설명만 짧아진 것이지 일정은 정상이다. 오류 톤이 아니라 성공 톤으로 안내한다.
        onShowToast?.(
          degraded
            ? "일정은 수정했지만 설명을 다 쓰지 못했습니다. 다시 시도하면 설명이 채워집니다."
            : applied.length > 0
              ? "일정이 피드백을 반영해 수정되었습니다!"
              : "반영할 수 있는 조건을 찾지 못해 장소만 다시 골랐습니다.",
          "success",
        );
      } else {
        setFeedbackMessages((prev) => [
          ...prev,
          { role: "ai", text: data.error?.message || "일정을 수정하지 못했어요. 다시 시도해주세요." },
        ]);
      }
    } catch (err) {
      console.error("revise-plan request failed:", err);
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setFeedbackMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: timedOut
            ? "응답이 너무 오래 걸려 중단했어요. 잠시 후 다시 시도해주세요."
            : "네트워크 오류로 일정을 수정하지 못했어요.",
        },
      ]);
    } finally {
      clearTimeout(abortTimer);
      setIsRevising(false);
    }
  };

  return (
    <div className="mt-8 bg-white rounded-2xl border border-outline-variant/35 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-outline-variant/30 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary flex items-center justify-center">forum</span>
        <h4 className="text-sm font-extrabold text-on-surface">AI에게 일정 수정 요청하기</h4>
      </div>

      {feedbackMessages.length > 0 && (
        <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
          {feedbackMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-white"
                    : "bg-surface-container text-on-surface"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isRevising && (
            <div className="flex justify-start">
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl text-xs bg-surface-container text-on-surface-variant">
                AI가 일정을 수정하는 중...
              </div>
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendFeedback();
        }}
        className="flex items-center gap-2 px-4 py-3 border-t border-outline-variant/30"
      >
        <input
          type="text"
          value={feedbackInput}
          onChange={(e) => setFeedbackInput(e.target.value)}
          placeholder="예: 맛집 위주로 바꿔줘, 좀 더 여유롭게 해줘"
          disabled={isRevising}
          className="flex-1 bg-surface-container rounded-xl px-4 py-2.5 text-xs outline-none border-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isRevising || !feedbackInput.trim()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-none active:scale-90 transition-all shrink-0"
        >
          <span className="material-symbols-outlined text-lg flex items-center justify-center">send</span>
        </button>
      </form>
    </div>
  );
}
