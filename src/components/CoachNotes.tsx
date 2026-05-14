import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  createCoachNote,
  deleteCoachNote,
  subscribeCoachNotes,
  getUserDoc,
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
  const [connectedTeachers, setConnectedTeachers] = useState<{ uid: string; name: string }[]>([]);

  // Firestore-оос бодит цагт уншина
  useEffect(() => {
    const unsub = subscribeCoachNotes(childId, setNotes);
    return () => unsub();
  }, [childId]);

  // Хүүхдэд холбогдсон багшийн нэрийг татах
  useEffect(() => {
    if (isTeacher || teacherIds.length === 0) return;
    async function loadTeachers() {
      const results: { uid: string; name: string }[] = [];
      for (const uid of teacherIds) {
        try {
          const doc = await getUserDoc(uid);
          if (doc) results.push({ uid, name: doc.displayName ?? "Багш" });
        } catch {
          // ignore
        }
      }
      setConnectedTeachers(results);
    }
    loadTeachers();
  }, [teacherIds, isTeacher]);

  async function handleAdd() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await createCoachNote(childId, teacherId, teacherName, text.trim());
      setText("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteCoachNote(id);
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
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">✏️</span>
            <div>
              <h3 className="font-semibold text-stone-900 text-sm">
                {t("coach.writeNote", { name: childName })}
              </h3>
              <p className="text-xs text-stone-500">
                {t("coach.parentCanSee")}
              </p>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("coach.placeholder", { name: childName })}
            rows={4}
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !text.trim()}
            className="mt-2 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? t("coach.saving") : t("coach.addButton")}
          </button>
        </div>
      )}

      {/* Эцэг эхэд холбогдсон багшийн нэр харуулах */}
      {!isTeacher && connectedTeachers.length > 0 && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">
            {t("coach.connectedTeacher")}
          </p>
          <div className="flex flex-wrap gap-2">
            {connectedTeachers.map((tc) => (
              <div key={tc.uid} className="flex items-center gap-2 bg-white border border-emerald-200 rounded-xl px-3 py-1.5">
                <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                  {tc.name.slice(0, 1).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-stone-800">{tc.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Зөвлөгөөний жагсаалт */}
      {notes.length === 0 ? (
        <div className="text-center py-10 text-stone-400 text-sm">
          {isTeacher ? t("coach.empty") : t("coach.parentEmpty")}
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    {n.teacherName?.slice(0, 1).toUpperCase() ?? "Б"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800">
                      {n.teacherName}
                    </p>
                    <p className="text-xs text-stone-400">
                      {formatDate(n.createdAt)}
                    </p>
                  </div>
                </div>
                {isTeacher && n.teacherId === teacherId && (
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="text-xs text-stone-400 hover:text-red-500 transition"
                  >
                    {t("coach.delete")}
                  </button>
                )}
              </div>
              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                {n.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
