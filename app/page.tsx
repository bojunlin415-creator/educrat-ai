import Link from "next/link";
import { Card } from "@/components/ui/card";

const highlights = [
  {
    icon: "準",
    title: "對準教學現場",
    copy: "從年級、科目與學習重點開始，保留教師的專業判斷。",
  },
  {
    icon: "檢",
    title: "匯出前先品檢",
    copy: "教材必須通過內容、安全與格式檢核，才進入匯出流程。",
  },
  {
    icon: "省",
    title: "把時間還給老師",
    copy: "以清楚的步驟整理教材草稿，不取代教師最後的審閱。",
  },
];

export default function Home() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <p className="mb-5 inline-flex rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900">
            台灣國小教師的備課夥伴
          </p>
          <h1 className="max-w-3xl text-4xl leading-tight font-black tracking-tight text-emerald-950 sm:text-6xl">
            好教材，從老師的教學想法開始。
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            課堂星球協助你把教學目標整理成可調整、可檢查的教材草稿。AI
            負責加速，教師保有每一個重要決定。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="rounded-xl bg-emerald-700 px-6 py-3 text-center font-bold text-white shadow-lg shadow-emerald-900/15 hover:bg-emerald-800"
              href="/login"
            >
              開始使用
            </Link>
            <Link
              className="rounded-xl border border-emerald-900/15 bg-white px-6 py-3 text-center font-bold text-emerald-950 hover:bg-emerald-50"
              href="/dashboard"
            >
              預覽工作台
            </Link>
          </div>
        </div>
        <Card className="relative overflow-hidden border-0 bg-emerald-900 p-7 text-white shadow-2xl shadow-emerald-950/20">
          <div
            aria-hidden="true"
            className="absolute -top-12 -right-12 size-44 rounded-full bg-amber-400/25"
          />
          <p className="text-sm font-bold text-emerald-200">今日備課進度</p>
          <p className="mt-2 text-3xl font-black">三年級自然</p>
          <div className="mt-8 space-y-3">
            {[
              "設定學習重點",
              "產生教材草稿",
              "教師內容審閱",
              "品質檢查與匯出",
            ].map((step, index) => (
              <div
                className="flex items-center gap-3 rounded-xl bg-white/10 p-3"
                key={step}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white font-black text-emerald-900">
                  {index + 1}
                </span>
                <span className="font-bold">{step}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>
      <section className="border-y border-emerald-950/10 bg-white py-16">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 sm:px-6 md:grid-cols-3">
          {highlights.map((item) => (
            <Card className="p-6" key={item.title}>
              <span className="grid size-11 place-items-center rounded-xl bg-amber-100 font-black text-amber-800">
                {item.icon}
              </span>
              <h2 className="mt-5 text-xl font-black text-emerald-950">
                {item.title}
              </h2>
              <p className="mt-2 leading-7 text-slate-600">{item.copy}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
