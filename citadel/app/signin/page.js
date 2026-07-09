import Link from "next/link";
import SigninForm from "@/components/signin-form";
import RingMark from "@/components/ring-mark";

export const dynamic = "force-dynamic";

export default async function SigninPage({ searchParams }) {
  const params = await searchParams;

  return (
    <main className="min-h-dvh px-3 py-3">
      <div className="mx-auto flex min-h-[calc(100dvh-24px)] w-full max-w-[560px] flex-col rounded-[28px] border border-parchment/10 px-6 pb-10 pt-12 sm:px-10">
        <header className="text-center">
          <Link href="/" className="inline-block">
            <RingMark className="mx-auto h-28 w-28 text-parchment/60" />
            <h1 className="mt-6 font-display text-5xl font-light tracking-[0.16em] text-parchment">
              Citadel
            </h1>
          </Link>
          <p className="mx-auto mt-5 max-w-[320px] text-center text-lg leading-relaxed text-ash">
            A private place to write, each evening, about what tested you.
          </p>
        </header>
        {params?.error === "link" && (
          <p className="mt-8 text-center text-ash">
            That sign-in didn&apos;t complete. Try again.
          </p>
        )}
        <SigninForm />
      </div>
    </main>
  );
}
