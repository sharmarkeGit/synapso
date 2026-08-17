'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import Link from 'next/link'

type DueCard = {
  id: string
  question: string
  answer: string
  topicTitle: string
}

async function fetchDueCards(): Promise<DueCard[]> {
  const res = await fetch('/api/review/due')
  if (!res.ok) throw new Error('Failed to fetch due cards')
  return res.json()
}

async function submitReview(cardId: string, quality: number) {
  const res = await fetch('/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, quality }),
  })
  if (!res.ok) throw new Error('Failed to submit review')
  return res.json()
}

const qualityLabels = [
  { value: 0, label: 'Blackout', color: 'bg-red-600' },
  { value: 1, label: 'Wrong', color: 'bg-red-500' },
  { value: 2, label: 'Wrong (close)', color: 'bg-orange-500' },
  { value: 3, label: 'Hard', color: 'bg-yellow-500' },
  { value: 4, label: 'Good', color: 'bg-lime-600' },
  { value: 5, label: 'Easy', color: 'bg-green-600' },
]

export default function ReviewPage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)

  const { data: cards, isLoading } = useQuery({
    queryKey: ['review', 'due'],
    queryFn: fetchDueCards,
  })

  const reviewMutation = useMutation({
    mutationFn: ({ cardId, quality }: { cardId: string; quality: number }) =>
      submitReview(cardId, quality),
    onSuccess: () => {
      setIsRevealed(false)
      setCurrentIndex((prev) => prev + 1)
    },
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center text-neutral-500">
        Loading your review session...
      </div>
    )
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">All caught up</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          No cards are due for review right now. Come back later.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            ← Back to dashboard
        </Link>
      </div>
    )
  }

  if (currentIndex >= cards.length) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">Session complete</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          You reviewed {cards.length} card{cards.length > 1 ? 's' : ''}. Nice work.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        ← Back to dashboard
      </Link>
      </div>
    )
  }

  const currentCard = cards[currentIndex]

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
  <div className="flex items-center justify-between">
    <p className="text-sm text-neutral-500">
      Card {currentIndex + 1} of {cards.length}
    </p>
    <Link
  href="/dashboard"
  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
>
  Exit session
</Link>
  </div>

  <div className="mt-6 rounded-xl border border-neutral-200 p-8 dark:border-neutral-800">
    <p className="text-sm font-semibold uppercase tracking-wide text-indigo-500">
      {currentCard.topicTitle}
    </p>
    <p className="mt-1 text-lg font-medium">{currentCard.question}</p>
        

        {isRevealed && (
          <p className="mt-4 border-t border-neutral-200 pt-4 text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
            {currentCard.answer}
          </p>
        )}

        {!isRevealed ? (
          <button
            onClick={() => setIsRevealed(true)}
            className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Show answer
          </button>
        ) : (
          <div className="mt-6">
            <p className="mb-3 text-sm text-neutral-500">How well did you recall this?</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {qualityLabels.map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={() =>
                    reviewMutation.mutate({ cardId: currentCard.id, quality: value })
                  }
                  disabled={reviewMutation.isPending}
                  className={`${color} rounded-lg px-2 py-2.5 text-xs font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}