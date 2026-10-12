// =============================================================================
// AdminPage — promo code management. UI gate: ADMIN_EMAIL; enforced server-side in /api/promo/admin.
// =============================================================================

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  createPromoCode,
  listPromoCodes,
  seedPromoCodes,
  togglePromoCode,
  type PromoCode,
} from "../lib/promoClient";

const ADMIN_EMAIL = "gansolongozorigt7@gmail.com";

export default function AdminPage({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div
        className="cs-modal-backdrop cs-backdrop-in"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="cs-modal cs-panel-in sm:max-w-sm"
        >
          <div className="cs-handle" />
          <div className="p-8 text-center">
          <p className="t-body-strong text-ink">{t("admin.accessDenied")}</p>
          <button
            type="button"
            onClick={onClose}
            className="cs-btn cs-btn-ink mt-4"
          >
            {t("delete.cancel")}
          </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="cs-modal-backdrop cs-backdrop-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cs-modal cs-panel-in sm:max-w-lg"
      >
        <div className="cs-handle" />
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="t-h1">{t("admin.title")}</h2>
          <button type="button" onClick={onClose} className="cs-icon-btn" aria-label={t("delete.cancel")}><X size={20} /></button>
        </header>
        <div className="px-5 py-5 space-y-6">
          <PromoSection />
        </div>
      </div>
    </div>
  );
}

function PromoSection() {
  const { t } = useTranslation();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [code, setCode] = useState("");
  const [months, setMonths] = useState(3);
  const [maxUses, setMaxUses] = useState(100);
  const [expiry, setExpiry] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoadingCodes(true);
    setLoadError(null);
    try {
      setCodes(await listPromoCodes());
    } catch (e) {
      console.error("[champstep] promo list failed:", e);
      setLoadError(t("admin.error"));
    } finally {
      setLoadingCodes(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setCreating(true);
    setCreateMsg(null);
    try {
      await createPromoCode({
        code: code.trim().toUpperCase(),
        discountMonths: months,
        maxUses,
        expiresAt: new Date(expiry).toISOString(),
      });
      setCreateMsg(t("admin.created"));
      setCode("");
      await load();
    } catch (e) {
      console.error("[champstep] promo create failed:", e);
      setCreateMsg(t("admin.error"));
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(code: string, currentActive: boolean) {
    setTogglingCode(code);
    try {
      await togglePromoCode(code, !currentActive);
      await load();
    } catch (e) {
      console.error("[champstep] promo toggle failed:", e);
      setLoadError(t("admin.error"));
    } finally {
      setTogglingCode(null);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setSeedMsg(null);
    try {
      await seedPromoCodes();
      setSeedMsg(t("admin.seeded"));
      await load();
    } catch (e) {
      console.error("[champstep] promo seed failed:", e);
      setSeedMsg(t("admin.error"));
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div>
      <h3 className="t-h2 mb-3">{t("admin.promoSection")}</h3>

      {/* Seed button */}
      <div className="mb-4">
        <button
          type="button"
          onClick={handleSeed}
          disabled={seeding}
          className="cs-btn cs-btn-outline cs-btn-sm"
        >
          {seeding ? t("admin.seeding") : t("admin.seedButton")}
        </button>
        {seedMsg && <span className="ml-3 t-caption text-primary">{seedMsg}</span>}
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} className="cs-card p-4 space-y-3 mb-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="cs-field-label">{t("admin.codeName")}</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CHAMP3"
              required
              className="cs-input"
            />
          </div>
          <div>
            <label className="cs-field-label">{t("admin.months")}</label>
            <input
              type="number"
              min={1}
              max={24}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="cs-input"
            />
          </div>
          <div>
            <label className="cs-field-label">{t("admin.maxUses")}</label>
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              className="cs-input"
            />
          </div>
          <div>
            <label className="cs-field-label">{t("admin.expiry")}</label>
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="cs-input"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="cs-btn cs-btn-primary w-full"
        >
          {creating ? t("admin.creating") : t("admin.createButton")}
        </button>
        {createMsg && <p className="t-caption text-primary">{createMsg}</p>}
      </form>

      {/* Code list */}
      <h4 className="t-label mb-2">{t("admin.listHeading")}</h4>
      {loadError && <p className="mb-2 t-caption text-error">{loadError}</p>}
      {loadingCodes ? (
        <p className="t-caption">{t("admin.loading")}</p>
      ) : codes.length === 0 ? (
        <p className="t-caption">—</p>
      ) : (
        <div className="space-y-2">
          {codes.map((c) => (
            <div key={c.code} className="cs-card px-3 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="font-mono text-[13px] font-extrabold text-ink">{c.code}</span>
                <span className="t-caption">{c.discountMonths}mo</span>
                <button
                  type="button"
                  disabled={togglingCode === c.code}
                  onClick={() => handleToggle(c.code, c.active)}
                  aria-pressed={c.active}
                  className={`cs-chip ${c.active ? "" : "cs-chip-muted"} cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-40`}
                >
                  {c.active ? t("admin.active") : t("admin.inactive")}
                </button>
              </div>
              <span className="t-caption tabular-nums shrink-0">
                {c.usedBy.length}/{c.maxUses} {t("admin.used")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}