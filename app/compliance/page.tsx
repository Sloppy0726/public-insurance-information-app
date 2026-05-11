import Link from 'next/link';

const IA_LINKS = [
  {
    label: 'IA Explanatory Note on Regulated Activities',
    href: 'https://www.ia.org.hk/tc/legislative_framework/files/Explanatory_Note_on_Regulated_Activities.pdf',
  },
  {
    label: 'IA Guideline on Financial Needs Analysis (GL30)',
    href: 'https://www.ia.org.hk/en/legislative_framework/files/GL30_English.pdf',
  },
  {
    label: 'IA Regulation of Insurance Intermediaries',
    href: 'https://www.ia.org.hk/en/supervision/reg_ins_intermediaries/introduction_of_insurance_intermediaries.html',
  },
  {
    label: 'IA Guideline on Benefit Illustrations (GL28)',
    href: 'https://www.ia.org.hk/en/legislative_framework/files/GL28_English.pdf',
  },
];

const SAFE_BOUNDARIES = [
  '展示公開或已抽取的產品資料、保費、供款期、退保價值、保證及非保證數字。',
  '按用戶自選欄位排序，例如供款年期、付款方式、指定年份退保/已供比例。',
  '用資金金額做情境模擬，顯示不同產品在同一假設下的現金流及退保曲線。',
  '解釋比較方法、資料來源、非保證風險、早期退保損失及資料缺口。',
];

const PROHIBITED_COPY = [
  '不使用「最適合你」、「建議購買」、「best buy」、「推薦」等語句。',
  '不把排序第一項包裝成投保建議或 suitability conclusion。',
  '不代客填寫或提交投保申請，不收取保費，不安排保險合約。',
  '不把用戶資料直接轉交保險公司、agent 或 broker 作申請用途，除非進入持牌/FNA流程。',
  '不把廣告、代理曝光或商業合作放入排序算法。',
];

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            返回首頁
          </Link>
          <h1 className="mt-3 text-3xl font-black tracking-normal">資料排序及模擬限制</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            本平台目標係整理保險產品資料，提供透明排序、X-Ray 同情境模擬。平台不作投保、轉保、退保或產品適合性建議，亦不安排任何保險合約。
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">產品定位</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            用戶輸入資金、供款年期、付款方式或其他偏好時，平台只會把該輸入視為模擬假設，然後按用戶選定的欄位重新排序資料。排序結果不代表平台認為任何產品適合該用戶。
          </p>
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">可以做</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              {SAFE_BOUNDARIES.map(item => (
                <li key={item} className="rounded-md bg-slate-50 px-3 py-2">{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">不可做</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              {PROHIBITED_COPY.map(item => (
                <li key={item} className="rounded-md bg-rose-50 px-3 py-2 text-rose-900">{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-4 rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">何時需要持牌/FNA流程</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            如果平台或人員開始就某一名用戶作出指定保單建議、安排申請、轉介保險業務、收取保費、把資料交予保險公司/中介作投保用途，或把結果包裝成個人化適合性結論，便應轉入持牌保險中介及 Financial Needs Analysis 流程。
          </p>
        </section>

        <section className="mt-4 rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">官方參考</h2>
          <div className="mt-3 grid gap-2">
            {IA_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-50"
              >
                {link.label}
              </a>
            ))}
          </div>
        </section>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-slate-500">
          本頁只係平台產品設計限制，唔係法律意見。正式上線前應由香港保險合規或法律顧問審閱。
        </p>
      </main>
    </div>
  );
}
