import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import LoginForm from "./LoginForm";
import { setAdminLanguage } from "../actions";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  const { lang, t } = await getAdminT();
  const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

  return (
    <div className="grid min-h-screen bg-brand-soft lg:grid-cols-[1.1fr_1fr]">
      {/* brand panel */}
      <aside className="relative hidden overflow-hidden bg-brand-dark lg:block" aria-hidden="true">
        <div className="zds-blob absolute -start-24 -top-24 h-96 w-96 bg-brand opacity-60" />
        <div className="zds-blob absolute -end-32 bottom-[-6rem] h-[28rem] w-[28rem] bg-header opacity-30" style={{ animationDelay: "-6s" }} />

        {/* running stitch line */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 800" preserveAspectRatio="none" fill="none">
          <path
            className="zds-stitch"
            d="M-20 640 C 120 520, 60 360, 220 330 S 420 420, 470 260 S 560 60, 640 40"
            stroke="white"
            strokeOpacity="0.35"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>

        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Image src="/images/icons/999-14.svg" alt="" width={170} height={65} className="zds-rise h-14 w-auto" priority />

          <Image
            src="/images/group-155-1.png"
            alt=""
            width={703}
            height={760}
            priority
            className="zds-float mx-auto h-auto w-[min(70%,26rem)] drop-shadow-2xl"
          />

          <div className="zds-rise" style={delay(300)}>
            <p className="font-script text-6xl leading-none">{lang === "ar" ? "صُنع بحب" : "Crafted with Love"}</p>
            <p className="mt-4 text-sm tracking-[0.2em] text-white/70 uppercase rtl:tracking-normal">Zahras Design Studio</p>
          </div>
        </div>
      </aside>

      {/* form */}
      <main className="relative flex items-center justify-center px-6 py-16">
        <form action={setAdminLanguage} className="zds-rise absolute end-6 top-6" style={delay(500)}>
          <input type="hidden" name="lang" value={lang === "ar" ? "en" : "ar"} />
          <button className="rounded-full border border-brand/30 bg-white/70 px-4 py-1.5 text-sm text-brand-dark backdrop-blur transition hover:bg-white">
            🌐 {t.nav.switchLanguage}
          </button>
        </form>

        <div className="w-full max-w-sm">
          <div className="zds-rise text-center lg:hidden">
            <div className="mx-auto grid h-16 w-40 place-items-center rounded-2xl bg-brand-dark px-4">
              <Image src="/images/icons/999-14.svg" alt="Zahras Design Studio" width={146} height={56} className="h-10 w-auto" priority />
            </div>
          </div>

          <svg className="zds-rise mx-auto mt-6 hidden lg:block" width="64" height="20" viewBox="0 0 64 20" fill="none" aria-hidden="true">
            <path className="zds-draw" d="M2 10 L14 4 L26 16 L38 4 L50 16 L62 10" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <h1 className="zds-rise mt-6 text-center font-sans text-3xl font-semibold text-ink" style={delay(100)}>
            {lang === "ar" ? "مرحبًا بعودتك" : "Welcome back"}
          </h1>
          <p className="zds-rise mt-2 text-center text-sm text-muted" style={delay(200)}>{t.login.subtitle}</p>

          <div className="zds-rise mt-8 rounded-3xl border border-white bg-white/80 p-8 shadow-[0_20px_60px_-20px_rgba(164,110,98,0.35)] backdrop-blur" style={delay(300)}>
            <LoginForm />
          </div>

          <p className="zds-rise mt-8 text-center text-xs text-muted" style={delay(450)}>
            © {new Date().getFullYear()} Zahras Design Studio
          </p>
        </div>
      </main>
    </div>
  );
}
