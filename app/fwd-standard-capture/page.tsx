import Link from 'next/link';
import { loadFwdStandardCaptureData } from '@/lib/fwd-standard-capture';
import StandardCaptureClient from './StandardCaptureClient';

export default function FwdStandardCapturePage() {
  const data = loadFwdStandardCaptureData();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                返回首頁
              </Link>
              <h1 className="mt-2 text-2xl font-black tracking-normal">FWD Standard Capture</h1>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
                先用已封存 PDF 做 consumer budget 比較：年供 USD 15,600、月供 USD 1,300；固定保額 quote 會分開標示。
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800">
              Standard view
            </div>
          </div>
        </div>
      </header>

      <StandardCaptureClient
        rows={data.rows}
        productSummaries={data.productSummaries}
        categorySummaries={data.categorySummaries}
        bucketSummaries={data.bucketSummaries}
        stats={data.stats}
      />
    </div>
  );
}
