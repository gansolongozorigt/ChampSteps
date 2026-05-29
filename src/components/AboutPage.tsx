import { useTranslation } from "react-i18next";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-2.5 border-b border-stone-100 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 sm:w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-[13px] text-stone-700">{children}</span>
    </div>
  );
}

export default function AboutPage() {
  const { i18n } = useTranslation();
  const isMn = (i18n.resolvedLanguage ?? i18n.language) === "mn";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-stone-900">
          {isMn ? "Бидний тухай" : "About Us"}
        </h2>
      </div>

      {/* App intro card */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-stone-950 flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="ag1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d97706" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#d97706" stopOpacity="0.12" />
                </linearGradient>
                <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d97706" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#b45309" stopOpacity="0.5" />
                </linearGradient>
                <linearGradient id="ag3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#92400e" />
                </linearGradient>
              </defs>
              <rect x="4" y="32" width="10" height="12" rx="2.5" fill="url(#ag1)" />
              <rect x="17" y="22" width="10" height="22" rx="2.5" fill="url(#ag2)" />
              <rect x="30" y="10" width="10" height="34" rx="2.5" fill="url(#ag3)" />
              <circle cx="35" cy="7" r="5.5" fill="white" fillOpacity="0.1" />
              <path d="M35 4.2L36.1 6.7H38.7L36.6 8.2L37.4 10.8L35 9.3L32.6 10.8L33.4 8.2L31.3 6.7H33.9Z" fill="#fbbf24" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-bold text-stone-900">
              <span>Champ</span>
              <span style={{ background: "linear-gradient(135deg,#fbbf24 0%,#d97706 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Step</span>
            </p>
            <p className="text-[10px] text-stone-400 uppercase tracking-widest">Digital Portfolio App</p>
          </div>
        </div>
        <p className="text-[13px] text-stone-600 leading-relaxed">
          {isMn
            ? "ChampStep нь хүүхдийн амжилт, ур чадвар, өсөлтийг бүртгэж PDF портфолио үүсгэх монгол эцэг эх, багш нарт зориулсан дижитал апп юм."
            : "ChampStep is a digital portfolio app for Mongolian parents and teachers to record children's achievements and export beautiful PDF portfolios."}
        </p>
      </div>

      {/* Company info card */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-3">
          {isMn ? "Байгууллагын мэдээлэл" : "Company Information"}
        </h3>
        <div>
          <InfoRow label={isMn ? "Нэр" : "Name"}>
            {isMn ? '"Итгэлийн Шинэ Улирал" ХХК' : "New Season for Faith Co.,Ltd"}
          </InfoRow>
          <InfoRow label={isMn ? "Хаяг" : "Address"}>
            {isMn
              ? "Улаанбаатар хот, Баянзүрх дүүрэг, 42-р хороо, 14-р хороолол, Алтан тэвш, 60б, 21 тоот"
              : "Altantevsh 60b apt 21, 14th khoroolol, 42nd khoroo, Bayanzurkh, Ulaanbaatar, Mongolia"}
          </InfoRow>
          <InfoRow label={isMn ? "Веб" : "Website"}>
            <a href="https://www.champstep.mn" target="_blank" rel="noopener noreferrer"
              className="text-amber-600 hover:underline">
              www.champstep.mn
            </a>
          </InfoRow>
          <InfoRow label={isMn ? "И-мэйл" : "Email"}>
            <a href="mailto:info@champstep.mn" className="text-amber-600 hover:underline">
              info@champstep.mn
            </a>
          </InfoRow>
          <InfoRow label={isMn ? "Утас" : "Phone"}>
            +976 8998-3613
          </InfoRow>
        </div>
      </div>

      {/* Service info card */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-3">
          {isMn ? "Үйлчилгээний мэдээлэл" : "Service Information"}
        </h3>
        <div>
          <InfoRow label={isMn ? "Төрөл" : "Type"}>
            {isMn ? "Цахим захиалгат үйлчилгээ (SaaS)" : "Digital subscription service (SaaS)"}
          </InfoRow>
          <InfoRow label={isMn ? "Хүргэлт" : "Delivery"}>
            {isMn
              ? "Тэр даруй — бүртгэлийн дараа шууд ашиглана"
              : "Instant — available immediately after signup"}
          </InfoRow>
          <InfoRow label={isMn ? "Төлбөр" : "Payment"}>
            {isMn
              ? "Сарын захиалга — банкны картаар"
              : "Monthly subscription — paid by bank card"}
          </InfoRow>
          <InfoRow label={isMn ? "Картын мэдээлэл" : "Card data"}>
            {isMn
              ? "Манай системд хадгалдаггүй — банкны gateway-ээр дамждаг"
              : "Not stored by us — processed by payment gateway"}
          </InfoRow>
        </div>
      </div>

      {/* Pricing card */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-3">
          {isMn ? "Үнийн жагсаалт" : "Pricing"}
        </h3>
        <div className="space-y-2">
          {[
            {
              name: isMn ? "Үнэгүй" : "Free",
              price: "₮0",
              desc: isMn ? "5 амжилт хүртэл" : "Up to 5 achievements",
            },
            {
              name: isMn ? "Гэр бүл" : "Family",
              price: "₮9,900",
              desc: isMn ? "3 хүүхэд · 30 амжилт · PDF" : "3 children · 30 achievements · PDF",
            },
            {
              name: isMn ? "Мастер" : "Master",
              price: "₮24,900",
              desc: isMn ? "5 хүүхэд · Хязгааргүй · PDF · AI" : "5 children · Unlimited · PDF · AI",
            },
            {
              name: isMn ? "Багш" : "Coach",
              price: "₮49,900",
              desc: isMn ? "Хязгааргүй шавь · Бүх боломж" : "Unlimited students · All features",
            },
          ].map((tier) => (
            <div key={tier.name} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
              <div>
                <p className="text-[13px] font-medium text-stone-800">{tier.name}</p>
                <p className="text-[11px] text-stone-400">{tier.desc}</p>
              </div>
              <span className="text-[13px] font-semibold text-amber-600">{tier.price}<span className="text-[10px] text-stone-400 font-normal">{isMn ? "/сар" : "/mo"}</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* Contact amber card */}
      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
        <p className="text-[13px] text-amber-800 leading-relaxed mb-3">
          {isMn
            ? "Асуулт, гомдол, санал хүсэлт байвал и-мэйл хаягаар бидэнтэй холбогдоно уу. 24 цагийн дотор хариу өгнө."
            : "For questions, complaints, or feedback, please contact us by email. We respond within 24 hours."}
        </p>
        <a href="mailto:info@champstep.mn"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-amber-700 hover:text-amber-900 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
          info@champstep.mn
        </a>
      </div>

      {/* Footer */}
      <p className="text-center text-[11px] text-stone-400 py-2">
        © 2025 Итгэлийн Шинэ Улирал ХХК · info@champstep.mn
      </p>
    </div>
  );
}
