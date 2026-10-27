"use client";

import { useEffect, useState } from "react";

type NicknameDialogProps = {
  open: boolean;
  initialNickname: string;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (nickname: string) => void;
};

export function NicknameDialog({ open, initialNickname, busy = false, onCancel, onSubmit }: NicknameDialogProps) {
  const [draft, setDraft] = useState(initialNickname);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel, open]);

  if (!open) return null;

  const submit = () => {
    const nickname = draft.trim();
    if (nickname.length < 2) {
      setValidationError("Tên cần ít nhất 2 ký tự.");
      return;
    }
    setValidationError(null);
    onSubmit(nickname);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="presentation">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5" role="dialog" aria-modal="true" aria-labelledby="nickname-dialog-title">
        <h2 id="nickname-dialog-title" className="text-lg font-semibold text-white">Tên của bạn</h2>
        <label htmlFor="nickname-dialog-input" className="mt-5 block text-sm text-slate-300">Tên hiển thị</label>
        <input
          id="nickname-dialog-input"
          autoFocus
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (validationError) setValidationError(null);
          }}
          onKeyDown={(event) => { if (event.key === "Enter" && !busy) submit(); }}
          maxLength={20}
          placeholder="Ví dụ: Mèo Lười"
          className="mt-2 w-full rounded-xl border border-line bg-ink px-3.5 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-mint"
        />
        {validationError && <p className="mt-2 text-sm text-red-300" role="alert">{validationError}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl px-3.5 py-2.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50">Hủy</button>
          <button type="button" onClick={submit} disabled={busy} className="rounded-xl bg-mint px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Đang xử lý…" : "Tiếp tục"}</button>
        </div>
      </div>
    </div>
  );
}
