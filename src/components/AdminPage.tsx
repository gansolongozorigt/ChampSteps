// =============================================================================
// AdminPage — promo code management (guarded by hardcoded admin email)
// =============================================================================

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import {
  createPromoCode,
  listPromoCodes,
  seedPromoCodes,
  type PromoCode,
} from "../lib/firebase";

const ADMIN_EMAIL = "admin@champsteps.app";

export default function AdminPage({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="rounded-2xl bg-white p-8 shadow-xl text-center"
        >
          <p className="text-stone-700 font-medium">{t("admin.accessDenied")}</p>
          <button
            onClick={onClose}
            className="mt-4 rounded-lg bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-800"
          >
            {t("delete.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 backdrop-blur-sm p-2 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
          <h2 className="font-serif text-lg font-bold text-stone-900">{t("admin.title")}</h2>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
        </header>
        <div className="max-h-[80vh] overflow-y-auto px-5 py-5 space-y-6">
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

  async function load() {
    setLoadingCodes(true);
    try {
      setCodes(await listPromoCodes());
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
        active: true,
      });
      setCreateMsg(t("admin.created"));
      setCode("");
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setSeedMsg(null);
    try {
      await seedPromoCodes();
      setSeedMsg(t("admin.seeded"));
      await load();
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-700 mb-3">{t("admin.promoSection")}</h3>

      {/* Seed button */}
      <div className="mb-4">
        <button
          type="button"
          onClick={handleSeed}
          disabled={seeding}
          className="rounded-lg border border-stone-200 px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
        >
          {seeding ? t("admin.seeding") : t("admin.seedButton")}
        </button>
        {seedMsg && <span className="ml-3 text-xs text-emerald-600">{seedMsg}</span>}
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} className="rounded-xl border border-stone-200 p-4 space-y-3 mb-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">{t("admin.codeName")}</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CHAMP3"
              required
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">{t("admin.months")}</label>
            <input
              type="number"
              min={1}
              max={24}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">{t("admin.maxUses")}</label>
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">{t("admin.expiry")}</label>
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:bg-stone-400"
        >
          {creating ? t("admin.creating") : t("admin.createButton")}
        </button>
        {createMsg && <p className="text-xs text-emerald-600">{createMsg}</p>}
      </form>

      {/* Code list */}
      <h4 className="text-xs font-semibold text-stone-500 mb-2">{t("admin.listHeading")}</h4>
      {loadingCodes ? (
        <p className="text-xs text-stone-400">{t("admin.loading")}</p>
      ) : codes.length === 0 ? (
        <p className="text-xs text-stone-400">—</p>
      ) : (
        <div className="space-y-2">
          {codes.map((c) => (
            <div key={c.code} className="rounded-lg border border-stone-200 px-3 py-2 text-xs flex items-start justify-between gap-2">
              <div>
                <span className="font-mono font-bold text-stone-900">{c.code}</span>
                <span className="ml-2 text-stone-500">{c.discountMonths}mo</span>
                <span className={`ml-2 rounded px-1.5 py-0.5 ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                  {c.active ? t("admin.active") : t("admin.inactive")}
                </span>
              </div>
              <span className="text-stone-400 shrink-0">
                {c.usedBy.length}/{c.maxUses} {t("admin.used")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}