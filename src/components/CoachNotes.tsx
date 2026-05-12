import { useState, useEffect } from "react";
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
}

export default function CoachNotes({
  childId,
  childName,
  teacherId,
  teacherName,
  isTeacher,
}: Props) {
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  // Firestore-оос бодит цагт уншина
  useEffect(() => {
    const unsub = subscribeCoachNotes(childId, setNotes);
    return () => unsub();
  }, [childId]);

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

  return (
    <div className="space-y-4">
      {/* Багшийн зөвлөгөө бичих хэсэг */}
      {isTeacher && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">✏️</span>
            <div>
              <h3 className="font-semibold text-stone-900 text-sm">
                {childName}-д зөвлөгөө бичих
              </h3>
              <p className="text-xs text-stone-500">
                Эцэг эх харах боломжтой
              </p>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`${childName}-ийн бэлтгэл, дэвшлийн талаар зөвлөгөө бичнэ үү...`}
            rows={4}
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !text.trim()}
            className="mt-2 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? "Хадгалж байна..." : "Зөвлөгөө нэмэх"}
          </button>
        </div>
      )}

      {/* Зөвлөгөөний жагсаалт */}
      {notes.length === 0 ? (
        <div className="text-center py-10 text-stone-400 text-sm">
          {isTeacher
            ? "Одоогоор зөвлөгөө байхгүй байна. Дээр бичнэ үү!"
            : "Багш таньд одоогоор зөвлөгөө өгөөгүй байна."}
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm"
            >
              {/* Багшийн нэр, огноо */}
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
                      {n.createdAt
                        ? new Date(n.createdAt).toLocaleDateString("mn-MN", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : ""}
                    </p>
                  </div>
                </div>
                {/* Зөвхөн тухайн багш устгах */}
                {isTeacher && n.teacherId === teacherId && (
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="text-xs text-stone-400 hover:text-red-500 transition"
                  >
                    Устгах
                  </button>
                )}
              </div>
              {/* Зөвлөгөөний текст */}
              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                {n.note}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}