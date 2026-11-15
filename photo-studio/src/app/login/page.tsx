import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Connexion · TwinShoot Studio" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <span className="font-display text-xl font-semibold">
          Twin<span className="text-[#e8a07f]">Shoot</span>
        </span>
        <div>
          <h1 className="font-display text-5xl leading-tight">Votre séance photo pro, à la demande.</h1>
          <p className="mt-4 max-w-md text-white/70">Créez votre jumelle IA une fois. Générez des portraits pour votre site, vos campagnes et vos réseaux, quand vous en avez besoin.</p>
        </div>
        <p className="text-sm text-white/50">Vos photos restent privées et supprimables à tout moment.</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12 sm:px-6">
        <AuthForm googleEnabled={googleEnabled} />
      </section>
    </main>
  );
}
