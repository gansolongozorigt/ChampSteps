import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";
import Logo from "./Logo";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-2.5 border-b border-line last:border-0">
      <span className="t-label sm:w-28 shrink-0 pt-0.5">{label}</span>
      <span className="t-body text-ink-2">{children}</span>
    </div>
  );
}

export default function AboutPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-5">
        <h2 className="t-h1">
          {t("about.title")}
        </h2>
      </div>

      {/* App intro card */}
      <div className="cs-card p-5">
        <div className="flex items-center gap-3 mb-3">
          <Logo size={28} />
          <p className="t-label">{t("about.tagline")}</p>
        </div>
        <p className="t-body text-ink-2">
          {t("about.intro")}
        </p>
      </div>

      {/* Company info card */}
      <div className="cs-card p-5">
        <h3 className="t-label mb-3">
          {t("about.companyHeading")}
        </h3>
        <div>
          <InfoRow label={t("about.nameLabel")}>{t("about.name")}</InfoRow>
          <InfoRow label={t("about.regLabel")}>{t("about.reg")}</InfoRow>
          <InfoRow label={t("about.stateRegLabel")}>{t("about.stateReg")}</InfoRow>
          <InfoRow label={t("about.addressLabel")}>{t("about.address")}</InfoRow>
          <InfoRow label={t("about.webLabel")}>
            <a href="https://www.champstep.mn" target="_blank" rel="noopener noreferrer"
              className="font-bold text-primary hover:underline underline-offset-2">
              www.champstep.mn
            </a>
          </InfoRow>
          <InfoRow label={t("about.emailLabel")}>
            <a href="mailto:info@champstep.mn" className="font-bold text-primary hover:underline underline-offset-2">
              info@champstep.mn
            </a>
          </InfoRow>
          <InfoRow label={t("about.phoneLabel")}>
            +976 8998-3613
          </InfoRow>
        </div>
      </div>

      {/* Service info card */}
      <div className="cs-card p-5">
        <h3 className="t-label mb-3">
          {t("about.serviceHeading")}
        </h3>
        <div>
          <InfoRow label={t("about.typeLabel")}>{t("about.type")}</InfoRow>
          <InfoRow label={t("about.deliveryLabel")}>{t("about.delivery")}</InfoRow>
          <InfoRow label={t("about.paymentLabel")}>{t("about.payment")}</InfoRow>
          <InfoRow label={t("about.paymentDataLabel")}>{t("about.paymentData")}</InfoRow>
        </div>
      </div>

      {/* Pricing card */}
      <div className="cs-card p-5">
        <h3 className="t-label mb-3">
          {t("about.pricingHeading")}
        </h3>
        <div>
          {[
            { name: t("about.tierFree"),   price: "₮0",      desc: t("about.tierFreeDesc") },
            { name: t("about.tierFamily"), price: "₮9,900",  desc: t("about.tierFamilyDesc") },
            { name: t("about.tierMaster"), price: "₮24,900", desc: t("about.tierMasterDesc") },
            { name: t("about.tierCoach"),  price: "₮49,900", desc: t("about.tierCoachDesc") },
          ].map((tier) => (
            <div key={tier.name} className="flex items-center justify-between gap-3 py-2.5 border-b border-line last:border-0">
              <div className="min-w-0">
                <p className="t-body-strong text-ink">{tier.name}</p>
                <p className="t-caption">{tier.desc}</p>
              </div>
              <span className="t-body-strong text-ink tabular-nums shrink-0">{tier.price}<span className="t-caption font-semibold">{t("about.per")}</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* Contact — document tone: a single primary rule */}
      <div className="cs-card border-l-2 border-l-primary p-5">
        <p className="t-body text-ink-2 mb-3">
          {t("about.contact")}
        </p>
        <a href="mailto:info@champstep.mn"
          className="inline-flex min-h-[44px] items-center gap-2 text-[14px] font-bold text-primary hover:text-primary-hover transition-colors">
          <Mail size={18} strokeWidth={2} />
          info@champstep.mn
        </a>
      </div>

      {/* Footer */}
      <p className="text-center t-caption py-2">
        {t("about.footer")}
      </p>
    </div>
  );
}
