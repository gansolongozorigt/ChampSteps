import { useState } from "react";
import { useTranslation } from "react-i18next";

type Tab = "terms" | "refund" | "privacy";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-[13px] font-semibold text-stone-800 mb-1.5">{title}</h3>
      <div className="text-[13px] text-stone-600 leading-relaxed">{children}</div>
    </div>
  );
}

export default function TermsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("terms");

  const tabs: { id: Tab; label: string }[] = [
    { id: "terms",   label: t("terms.tabTerms") },
    { id: "refund",  label: t("terms.tabRefund") },
    { id: "privacy", label: t("terms.tabPrivacy") },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-stone-900">
          {t("terms.title")}
        </h2>
      </div>

      {/* Tab bar */}
      <div className="bg-stone-100 rounded-xl p-1 flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 text-[11px] font-medium px-2 py-2 rounded-lg transition-all ${
              tab === t.id
                ? "bg-white shadow-sm text-stone-900"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1 — Terms of Service */}
      {tab === "terms" && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <p className="text-[10px] text-stone-400 mb-4">{t("terms.lastUpdated")}</p>
          <Section title={t("terms.s1Title")}>{t("terms.s1")}</Section>
          <Section title={t("terms.s2Title")}>{t("terms.s2")}</Section>
          <Section title={t("terms.s3Title")}>{t("terms.s3")}</Section>
          <Section title={t("terms.s4Title")}>{t("terms.s4")}</Section>
          <Section title={t("terms.s5Title")}>{t("terms.s5")}</Section>
        </div>
      )}

      {/* Tab 2 — Refund Policy */}
      {tab === "refund" && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <p className="text-[10px] text-stone-400 mb-4">{t("terms.lastUpdated")}</p>
          <Section title={t("terms.r1Title")}>{t("terms.r1")}</Section>
          <Section title={t("terms.r2Title")}>{t("terms.r2")}</Section>
          <Section title={t("terms.r3Title")}>
            <ul className="list-disc list-inside space-y-1">
              <li>{t("terms.r3a")}</li>
              <li>{t("terms.r3b")}</li>
              <li>{t("terms.r3c")}</li>
              <li>{t("terms.r3d")}</li>
            </ul>
          </Section>
          <Section title={t("terms.r4Title")}>{t("terms.r4")}</Section>

          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 mt-2">
            <p className="text-[12px] text-amber-800 mb-2">{t("terms.refundCta")}</p>
            <a href="mailto:info@champstep.mn"
              className="text-[13px] font-semibold text-amber-700 hover:underline">
              info@champstep.mn
            </a>
          </div>
        </div>
      )}

      {/* Tab 3 — Privacy Policy */}
      {tab === "privacy" && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <p className="text-[10px] text-stone-400 mb-4">{t("terms.lastUpdated")}</p>
          <Section title={t("terms.p1Title")}>{t("terms.p1")}</Section>
          <Section title={t("terms.p2Title")}>{t("terms.p2")}</Section>
          <Section title={t("terms.p3Title")}>{t("terms.p3")}</Section>
          <Section title={t("terms.p4Title")}>{t("terms.p4")}</Section>
          <Section title={t("terms.p5Title")}>{t("terms.p5")}</Section>
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-[11px] text-stone-400 py-2">
        {t("terms.footer")}
      </p>
    </div>
  );
}
