import Link from "next/link";
import SigninForm from "@/components/signin-form";

export const dynamic = "force-dynamic";

export default async function SigninPage({ searchParams }) {
  const params = await searchParams;

  return (
    <main className="mx-auto min-h-screen max-w-[640px] px-6 py-16 sm:py-24">
      <header>
        <Link href="/">
          <h1 className="font-display text-4xl font-normal tracking-[0.08em]">
            Citadel
          </h1>
        </Link>
      </header>
      <section className="mt-16">
        {params?.error === "link" && (
          <p className="mb-8 text-ash">
            That link didn&apos;t work. Ask for another.
          </p>
        )}
        <SigninForm />
      </section>
    </main>
  );
}
