// =============================================================================
// InviteCode — Багш шавиа нэмэх систем
// TeacherInvitePanel: багш код үүсгэнэ
// ParentLinkPanel: эцэг эх код оруулна
// =============================================================================

import { useState } from "react";

// -----------------------------------------------------------------------------
// Багшийн тал — код үүсгэх
// -----------------------------------------------------------------------------

export interface TeacherInvitePanelProps {
  teacherId: string;
  teacherName: string;
  onCreateCode: (teacherId: string, teacherName: string) => Promise<string>;
}

export function TeacherInvitePanel({ teacherId, teacherName, onCreateCode }: TeacherInvitePanelProps) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setLoading(true);
    try {
      const newCode = await onCreateCode(teacherId, teacherName);
      setCode(newCode);
    } catch (e) {
      console.error("invite code create failed:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🏫</span>
        <div>
          <h3 className="font-semibold text-stone-900 text-sm">Шавь нэмэх</h3>
          <p className="text-xs text-stone-500">Эцэг эхэд код илгээж, шавиа нэмэ</p>
        </div>
      </div>

      {!code ? (
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Үүсгэж байна..." : "Урилгын код үүсгэх"}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-white border border-blue-200 p-4 text-center">
            <p className="text-xs text-stone-500 mb-1">Урилгын код</p>
            <p className="font-mono text-3xl font-bold tracking-widest text-blue-700">{code}</p>
            <p className="text-xs text-stone-400 mt-1">7 хоногийн дотор ашиглана</p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={`w-full rounded-xl py-2.5 text-sm font-medium transition ${
              copied
                ? "bg-emerald-600 text-white"
                : "bg-white border border-blue-200 text-blue-700 hover:bg-blue-50"
            }`}
          >
            {copied ? "✓ Хуулагдлаа!" : "Код хуулах"}
          </button>
          <button
            type="button"
            onClick={() => setCode(null)}
            className="w-full text-xs text-stone-400 hover:text-stone-600"
          >
            Шинэ код үүсгэх
          </button>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Эцэг эхийн тал — код оруулах
// -----------------------------------------------------------------------------

export interface ParentLinkPanelProps {
  childId: string;
  childName: string;
  onUseCode: (code: string, childId: string) => Promise<unknown>;
}

export function ParentLinkPanel({ childId, childName, onUseCode }: ParentLinkPanelProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLink() {
    if (code.trim().length !== 6) {
      setError("Код 6 тэмдэгт байх ёстой.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onUseCode(code.trim().toUpperCase(), childId);
      setSuccess("Амжилттай холбогдлоо!");
      setCode("");
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("аль хэдийн")) setError("Энэ код аль хэдийн ашиглагдсан байна.");
      else if (msg.includes("дууссан")) setError("Кодын хугацаа дууссан байна.");
      else if (msg.includes("олдсонгүй")) setError("Хүүхэд олдсонгүй.");
      else setError("Код буруу байна. Дахин шалгаарай.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🔗</span>
        <div>
          <h3 className="font-semibold text-stone-900 text-sm">Багштай холбогдох</h3>
          <p className="text-xs text-stone-500">{childName}-г багшийн бүртгэлд нэмэх</p>
        </div>
      </div>

      {success ? (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
          <p className="text-2xl mb-1">✅</p>
          <p className="text-sm font-medium text-emerald-700">{success}</p>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="mt-2 text-xs text-stone-400 hover:text-stone-600"
          >
            Дахин холбох
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().slice(0, 6));
              setError(null);
            }}
            placeholder="ABC123"
            maxLength={6}
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-center font-mono text-xl font-bold tracking-widest text-stone-900 uppercase focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          {error && <p className="text-xs text-rose-600 text-center">{error}</p>}
          <button
            type="button"
            onClick={handleLink}
            disabled={loading || code.length !== 6}
            className="w-full rounded-xl bg-amber-600 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? "Холбож байна..." : "Багштай холбогдох"}
          </button>
        </div>
      )}
    </div>
  );
}
