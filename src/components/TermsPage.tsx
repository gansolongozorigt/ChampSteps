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
  const { i18n } = useTranslation();
  const isMn = (i18n.resolvedLanguage ?? i18n.language) === "mn";
  const [tab, setTab] = useState<Tab>("terms");

  const tabs: { id: Tab; label: string }[] = [
    { id: "terms",   label: isMn ? "Үйлчилгээний нөхцөл" : "Terms of Service" },
    { id: "refund",  label: isMn ? "Буцаан олгох бодлого" : "Refund Policy" },
    { id: "privacy", label: isMn ? "Нууцлалын бодлого"   : "Privacy Policy" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-stone-900">
          {isMn ? "Нөхцөл" : "Terms"}
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
          <p className="text-[10px] text-stone-400 mb-4">
            {isMn ? "Сүүлд шинэчлэгдсэн: 2025 оны 5-р сар" : "Last updated: May 2025"}
          </p>

          <Section title={isMn ? "1. Үйлчилгээний тухай" : "1. About the Service"}>
            {isMn
              ? 'ChampStep нь хүүхдийн амжилт бүртгэх цахим үйлчилгээ. "Итгэлийн Шинэ Улирал" ХХК-аас үзүүлдэг.'
              : "ChampStep is a digital service for recording children's achievements, provided by New Season for Faith Co.,Ltd."}
          </Section>

          <Section title={isMn ? "2. Бүртгэл ба хэрэглэгчийн эрх" : "2. Registration & User Rights"}>
            {isMn
              ? "И-мэйл хаягаараа бүртгүүлнэ. Бүртгүүлэхэд картын мэдээлэл шаардахгүй. Нууц үгээ хэзээ ч хуваалцаж болохгүй."
              : "Register with your email. No card details required to register. Never share your password with others."}
          </Section>

          <Section title={isMn ? "3. Захиалга ба төлбөр" : "3. Subscription & Payment"}>
            {isMn
              ? "Премиум захиалга сар бүр автоматаар шинэчлэгдэнэ. Цуцлаагүй бол дараа сарын эхэнд дахин төлбөр авна. Төлбөрийг банкны картаар авна."
              : "Premium subscriptions renew automatically each month. Unless cancelled, you will be charged at the start of the next month. Payments are made by bank card."}
          </Section>

          <Section title={isMn ? "4. Хориглох зүйл" : "4. Prohibited Activities"}>
            {isMn
              ? "Бусдын хувийн мэдээлэл оруулах, систем эвдэх, хуурамч бүртгэл үүсгэх, зохиогчийн эрх зөрчихийг хориглоно."
              : "Prohibited: entering others' personal data, damaging the system, creating fake accounts, or copyright infringement."}
          </Section>

          <Section title={isMn ? "5. Үйлчилгээний зогсолт" : "5. Service Termination"}>
            {isMn
              ? "Дүрэм зөрчсөн тохиолдолд урьдчилан мэдэгдэлгүйгээр бүртгэлийг хаах эрхтэй. Та өөрийн бүртгэлийг хүссэн үедээ устгаж болно."
              : "We reserve the right to terminate accounts violating our rules without prior notice. You may delete your own account at any time."}
          </Section>
        </div>
      )}

      {/* Tab 2 — Refund Policy */}
      {tab === "refund" && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <Section title={isMn ? "1. Цуцлах нөхцөл" : "1. Cancellation Terms"}>
            {isMn
              ? "Захиалгаа хүссэн үедээ цуцалж болно. Цуцалсны дараа дараагийн тооцооны үеэс идэвхгүй болно. Одоогийн сарын хугацаа дуустал үйлчилгээ ашиглах боломжтой."
              : "You may cancel your subscription at any time. Cancellation takes effect from the next billing cycle. You may continue using the service until the period ends."}
          </Section>

          <Section title={isMn ? "2. Буцаан олгох нөхцөл" : "2. Refund Conditions"}>
            {isMn
              ? "Техникийн алдаанаас болж үйлчилгээ ашиглах боломжгүй болсон тохиолдолд 7 хоногийн дотор хүсэлт гаргавал буцааж олгоно. Хүсэлтийг info@champstep.mn руу илгээнэ."
              : "If the service is unavailable due to technical errors, refunds are available within 7 days upon request. Send requests to info@champstep.mn."}
          </Section>

          <Section title={isMn ? "3. Буцаан олгохгүй тохиолдол" : "3. Non-refundable Cases"}>
            {isMn ? (
              <ul className="list-disc list-inside space-y-1">
                <li>Захиалга ашигласны дараа цуцалсан тохиолдол</li>
                <li>Нөхцөл зөрчсөний улмаас бүртгэл хаагдсан тохиолдол</li>
                <li>Хэрэглэгчийн алдаанаас үүдсэн асуудал</li>
              </ul>
            ) : (
              <ul className="list-disc list-inside space-y-1">
                <li>Cancellation after using the subscription</li>
                <li>Account terminated due to policy violations</li>
                <li>Issues caused by user error</li>
              </ul>
            )}
          </Section>

          <Section title={isMn ? "4. Буцаан олгох хугацаа" : "4. Refund Timeline"}>
            {isMn
              ? "Хүсэлтийг 3–5 ажлын өдрийн дотор шийдвэрлэнэ. Мөнгийг банкны дансанд 7–14 ажлын өдрийн дотор буцаана."
              : "Requests are processed within 3–5 business days. Funds are returned to your bank account within 7–14 business days."}
          </Section>

          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 mt-2">
            <p className="text-[12px] text-amber-800 mb-2">
              {isMn ? "Буцаан олгох хүсэлт илгээх:" : "Submit a refund request:"}
            </p>
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
          <Section title={isMn ? "1. Цуглуулдаг мэдээлэл" : "1. Data We Collect"}>
            {isMn
              ? "И-мэйл хаяг, нэр, хүүхдийн амжилтын мэдээлэл. Картын мэдээлэл манай системд хадгалагддаггүй — банкны системээр дамждаг."
              : "Email address, name, and children's achievement data. Card information is NOT stored in our system — it passes through the bank's payment system."}
          </Section>

          <Section title={isMn ? "2. Мэдээллийг хэрхэн ашиглах" : "2. How We Use Your Data"}>
            {isMn
              ? "Зөвхөн үйлчилгээ үзүүлэх, захиалга удирдах, техникийн дэмжлэг үзүүлэх зорилгоор ашиглана. Гуравдагч этгээдэд зардаггүй, дамжуулдаггүй."
              : "Used only to provide the service, manage subscriptions, and offer technical support. Never sold or transferred to third parties."}
          </Section>

          <Section title={isMn ? "3. Мэдээллийн аюулгүй байдал" : "3. Data Security"}>
            {isMn
              ? "Бүх мэдээлэл Firebase дээр SSL шифрлэлттэй хадгалагдана. Нэвтрэх эрхийг Firebase Authentication удирддаг."
              : "All data is stored on Firebase with SSL encryption. Access is managed by Firebase Authentication."}
          </Section>
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-[11px] text-stone-400 py-2">
        © 2025 Итгэлийн Шинэ Улирал ХХК · info@champstep.mn
      </p>
    </div>
  );
}
