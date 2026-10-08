// =============================================================================
// ChildProfileEditor — Modal for editing the child's name, bio, birth date,
// and avatar photo. Avatar is compressed client-side before it would be
// uploaded to Firebase Storage. UI: brand tokens (docs/BRAND.md); logic unchanged.
// =============================================================================

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";
import type { Child } from "../types";
import { compressImage, validateImageFile } from "../utils/image";

export interface ChildProfileEditorProps {
  child: Child;
  onClose: () => void;
  /**
   * Fired with the updated Child record. `avatarFile` is the raw (already
   * compressed) File — upload it to Storage and swap `avatarUrl` with the
   * download URL in your Firebase callback.
   */
  onSave: (next: Child, avatarFile?: File) => Promise<void> | void;
  /** Rejected/undecodable avatar → parent shows a toast. */
  onError?: (message: string) => void;
}

export default function ChildProfileEditor({ child, onClose, onSave, onError }: ChildProfileEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Child>(child);
  const [avatarFile, setAvatarFile] = useState<File | undefined>(undefined);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(child.avatarUrl);
  const [saving, setSaving] = useState(false);

  // Revoke any object URLs we created when the component unmounts.
  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const initials = useMemo(() => draft.name.trim().slice(0, 1).toUpperCase() || "?", [draft.name]);

  async function handleAvatarChange(file: File | undefined) {
    if (!file) return;
    const rejected = validateImageFile(file);
    if (rejected) {
      onError?.(t(rejected === "size" ? "form.validation.imageSize" : "form.validation.imageType"));
      return;
    }
    let compressed: File;
    try {
      compressed = await compressImage(file, { maxDimension: 512, quality: 0.85 });
    } catch (e) {
      console.warn("[champstep] avatar decode failed:", e);
      onError?.(t("form.validation.imageType"));
      return;
    }
    setAvatarFile(compressed);
    const url = URL.createObjectURL(compressed);
    setAvatarPreview(url);
    setDraft((d) => ({ ...d, avatarUrl: url }));
  }

  function handleRemoveAvatar() {
    setAvatarFile(undefined);
    setAvatarPreview(undefined);
    setDraft((d) => ({ ...d, avatarUrl: undefined }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ ...draft, name: draft.name.trim() }, avatarFile);
      onClose();
    } catch {
      // parent already showed the error toast; keep the editor open with the draft
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cs-modal-backdrop cs-backdrop-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="cs-modal cs-panel-in sm:max-w-lg">
        <div className="cs-handle" />
        <div className="p-5 sm:p-6">
          <header>
            <p className="t-caption">{t("app.journal")}</p>
            <h2 className="t-h1 mt-1">{t("profile.heading")}</h2>
          </header>

          <div className="mt-6 flex items-center gap-5">
            <label className="group relative block h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-full bg-primary-soft ring-1 ring-line" title={t("profile.fields.avatar")}>
              {avatarPreview ? (
                <img src={avatarPreview} alt={draft.name} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-3xl font-extrabold text-primary-soft-ink">
                  {initials}
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex h-8 items-center justify-center bg-ink/70 text-white transition-colors group-hover:bg-ink/85" aria-hidden>
                <Camera size={16} strokeWidth={2.2} />
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => void handleAvatarChange(e.target.files?.[0])}
              />
            </label>
            <div className="flex flex-col items-start gap-1">
              <span className="t-body-strong text-ink">{t("profile.fields.avatar")}</span>
              {avatarPreview && (
                <button type="button" onClick={handleRemoveAvatar} className="cs-btn cs-btn-ghost cs-btn-sm -ml-3 text-error hover:text-error">
                  {t("profile.actions.removeAvatar")}
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <Field label={t("profile.fields.name")}>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="cs-input"
              />
            </Field>

            <Field label={t("profile.fields.birthDate")}>
              <input
                type="date"
                value={draft.birthDate}
                onChange={(e) => setDraft((d) => ({ ...d, birthDate: e.target.value }))}
                className="cs-input"
              />
            </Field>

            <Field label={t("profile.fields.bio")}>
              <textarea
                value={draft.bio ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
                rows={3}
                placeholder={t("profile.fields.bioPlaceholder")}
                className="cs-textarea"
              />
            </Field>
          </div>

          <div className="mt-8 flex items-center justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
            <button type="button" onClick={onClose} className="cs-btn cs-btn-ghost">
              {t("profile.actions.cancel")}
            </button>
            <button
              type="button"
              disabled={saving || !draft.name.trim()}
              onClick={handleSave}
              className="cs-btn cs-btn-primary"
            >
              {saving ? t("form.actions.saving") : t("profile.actions.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="cs-field-label">{label}</span>
      {children}
    </label>
  );
}
