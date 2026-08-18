import { SignUpButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Synapso</h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
          Learn anything faster with a curriculum built on how memory actually works.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <SignUpButton>
            <button className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-indigo-500">
              Get started free
            </button>
          </SignUpButton>
        </div>

        <div className="mt-20 grid gap-8 text-left sm:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              Active recall
            </h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Every topic generates recall questions with hidden answers, forcing your brain to
              retrieve, not just re-read.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              Spaced repetition
            </h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              An SM-2 scheduling engine decides exactly when you need to review something again.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              Feynman check
            </h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Explain a concept in your own words. An AI evaluates what you understood and what you
              missed.
            </p>
          </div>
        </div>

        <p className="mt-20 text-xs text-neutral-400 dark:text-neutral-600">
          Built on retrieval practice, spaced repetition, and interleaving — grounded in cognitive
          science research.
        </p>
      </div>
    </div>
  );
}
