import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center px-4 text-center">
      <div>
        <p className="text-7xl font-black text-amber-400">404</p>
        <h1 className="mt-4 text-3xl font-black text-emerald-950">
          這一頁還沒上課
        </h1>
        <p className="mt-3 text-slate-600">
          你尋找的頁面不存在，或已經移動位置。
        </p>
        <Link
          className="mt-7 inline-block rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800"
          href="/"
        >
          回到首頁
        </Link>
      </div>
    </main>
  );
}
