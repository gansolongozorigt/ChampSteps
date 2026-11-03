import { useState } from "react";
import { useTranslation } from "react-i18next";

export type TermsTab = "terms" | "refund" | "privacy";
type Tab = TermsTab;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="t-h2 mb-1.5">{title}</h3>
      <div className="t-body text-ink-2">{children}</div>
    </div>
  );
}

export default function TermsPage({ initialTab = "terms" }: { initialTab?: Tab } = {}) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: { id: Tab; label: string }[] = [
    { id: "terms",   label: t("terms.tabTerms") },
    { id: "refund",  label: t("terms.tabRefund") },
    { id: "privacy", label: t("terms.tabPrivacy") },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-2">
        <h2 className="t-h1">
          {t("terms.title")}
        </h2>
      </div>

      {/* Tab bar */}
      <div className="cs-segment w-full items-stretch" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            lang={i18n.language}
            // long labels (RU "Политика конфиденциальности") wrap to 2 lines on a phone instead of being cut
            className="cs-segment-item flex-1 basis-0 min-w-0 justify-center text-center whitespace-normal hyphens-auto [overflow-wrap:anywhere] leading-tight min-h-[44px] px-2 py-1 text-[12px]"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1 — Terms of Service */}
      {tab === "terms" && (
        <div className="cs-card p-5">
          <p className="t-caption mb-4">{t("terms.lastUpdated")}</p>
          <Section title={t("terms.s1Title")}>{t("terms.s1")}</Section>
          <Section title={t("terms.s2Title")}>{t("terms.s2")}</Section>
          <Section title={t("terms.s3Title")}>{t("terms.s3")}</Section>
          <Section title={t("terms.s4Title")}>{t("terms.s4")}</Section>
          <Section title={t("terms.s5Title")}>{t("terms.s5")}</Section>
        </div>
      )}

      {/* Tab 2 — Refund Policy */}
      {tab === "refund" && (
        <div className="cs-card p-5">
          <p className="t-caption mb-4">{t("terms.lastUpdated")}</p>
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

          <div className="border-l-2 border-primary bg-bg-soft rounded-r-input pl-4 pr-4 py-3 mt-2">
            <p className="t-body text-ink-2 mb-1">{t("terms.refundCta")}</p>
            <a href="mailto:info@champstep.mn"
              className="inline-flex min-h-[44px] items-center text-[14px] font-bold text-primary hover:underline underline-offset-2">
              info@champstep.mn
            </a>
          </div>
        </div>
      )}

      {/* Tab 3 — Privacy Policy */}
      {tab === "privacy" && (
        <div className="cs-card p-5">
          <p className="t-caption mb-4">{t("terms.lastUpdated")}</p>
          <Section title={t("terms.p1Title")}>{t("terms.p1")}</Section>
          <Section title={t("terms.p2Title")}>{t("terms.p2")}</Section>
          <Section title={t("terms.p3Title")}>{t("terms.p3")}</Section>
          <Section title={t("terms.p4Title")}>{t("terms.p4")}</Section>
          <Section title={t("terms.p5Title")}>{t("terms.p5")}</Section>
          <Section title={t("terms.p6Title")}>{t("terms.p6")}</Section>
        </div>
      )}

      {/* Footer */}
      <p className="text-center t-caption py-2">
        {t("terms.footer")}
      </p>
    </div>
  );
}
