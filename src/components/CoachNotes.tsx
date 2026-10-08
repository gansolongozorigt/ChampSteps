import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Eye, Pencil, Trash2 } from "lucide-react";
import {
  createCoachNote,
  deleteCoachNote,
  subscribeCoachNotes,
  type CoachNote,
} from "../lib/firebase";

interface Props {
  childId: string;
  childName: string;
  teacherId: string;
  teacherName: string;
  isTeacher: boolean;
  teacherIds?: string[]; // хүүхдийн холбогдсон багшийн ID-ууд
}

export default function CoachNotes({
  childId,
  childName,
  teacherId,
  teacherName,
  isTeacher,
  teacherIds = [],
}: Props) {
  const { t, i18n } = useTranslation();
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedTeachers, setConnectedTeachers] = useState<{ uid: string; name: string }[]>([]);

  // Firestore-оос бодит цагт уншина
  useEffect(() => {
    setError(null);
    const unsub = subscribeCoachNotes(childId, setNotes, () => setError(t("status.errorLoading")));
    return () => unsub();
  }, [childId, t]);

  // Холбогдсон багшийн нэр: users/{uid}-ийг өөр хэрэглэгч уншиж чадахгүй (rules),
  // тиймээс нэрийг тухайн багшийн бичсэн тэмдэглэлээс авна.
  useEffect(() => {
    if (isTeacher || teacherIds.length === 0) return;
    const names = new Map<string, string>();
    for (const n of notes) if (n.teacherId && n.teacherName) names.set(n.teacherId, n.teacherName);
    setConnectedTeachers(
      teacherIds.map((uid) => ({ uid, name: names.get(uid) ?? t("coach.defaultName") }))
    );
  }, [teacherIds, isTeacher, notes, t]);

  async function handleAdd() {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createCoachNote(childId, teacherId, teacherName, text.trim());
      setText("");
    } catch (e) {
      console.error("[champstep] coach note save failed:", e);
      setError(t("status.errorSaving")); // text stays in the box
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try { await deleteCoachNote(id); }
    catch (e) { console.error("[champstep] coach note delete failed:", e); setError(t("status.errorSaving")); }
  }

  function formatDate(createdAt: string | unknown) {
    if (!createdAt) return "";
    const date = typeof createdAt === "string"
      ? new Date(createdAt)
      : (createdAt as any).toDate?.() ?? new Date();
    const locale = i18n.language?.startsWith("en") ? "en-US" : "mn-MN";
    return date.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <div className="space-y-4">
      {/* Багшийн зөвлөгөө бичих хэсэг */}
      {isTeacher && (
        <div className="cs-card-soft p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="cs-badge cs-badge-primary"><Pencil size={18} strokeWidth={2} /></span>
            <div className="min-w-0">
              <h3 className="t-h2">
                {t("coach.writeNote", { name: childName })}
              </h3>
              <p className="t-caption mt-0.5 flex items-center gap-1.5">
                <Eye size={14} strokeWidth={2.2} className="shrink-0" />
                <span>{t("coach.parentCanSee")}</span>
              </p>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("coach.placeholder", { name: childName })}
            rows={4}
            className="cs-textarea bg-surface border-line"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !text.trim()}
            className="cs-btn cs-btn-primary w-full mt-3"
          >
            {saving ? t("coach.saving") : t("coach.addButton")}
          </button>
          {error && <p className="mt-2 t-caption text-error" role="alert">{error}</p>}
        </div>
      )}

      {/* Эцэг эхэд холбогдсон багшийн нэр харуулах */}
      {!isTeacher && connectedTeachers.length > 0 && (
        <div className="cs-card-soft p-4">
          <p className="t-label mb-2">
            {t("coach.connectedTeacher")}
          </p>
          <div className="flex flex-wrap gap-2">
            {connectedTeachers.map((tc) => (
              <div key={tc.uid} className="cs-chip cs-chip-outline h-9 pl-1.5 pr-3">
                <span className="w-6 h-6 rounded-full bg-primary-soft text-primary-soft-ink flex items-center justify-center text-[11px] font-extrabold">
                  {tc.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-[13px] font-bold text-ink">{tc.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Зөвлөгөөний жагсаалт */}
      {notes.length === 0 ? (
        <div className="cs-card-soft text-center py-10 px-4 t-body text-ink-3">
          {isTeacher ? t("coach.empty") : t("coach.parentEmpty")}
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div
              key={n.id}
              className="cs-card p-5 cs-item-in"
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="cs-badge cs-badge-primary text-[13px] font-extrabold">
                    {n.teacherName?.slice(0, 1).toUpperCase() ?? t("coach.defaultName").slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="t-body-strong text-ink truncate">
                      {n.teacherName}
                    </p>
                    <p className="t-caption">
                      {formatDate(n.createdAt)}
                    </p>
                  </div>
                </div>
                {isTeacher && n.teacherId === teacherId && (
                  <button
                    type="button"
                    onClick={() => handleDelete(n.id)}
                    className="cs-icon-btn text-ink-3 hover:text-error shrink-0"
                    aria-label={t("coach.delete")}
                    title={t("coach.delete")}
                  >
                    <Trash2 size={18} strokeWidth={2} />
                  </button>
                )}
              </div>
              <p className="t-body text-ink-2 whitespace-pre-wrap">
                {n.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
