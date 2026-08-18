'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type CardItem = {
  type: 'card'
  id: string
  question: string
  answer: string
  topicTitle: string
}

type FeynmanItem = {
  type: 'feynman'
  moduleId: string
  moduleTitle: string
  moduleContent: string
  topicTitle: string
}

type ReviewItem = CardItem | FeynmanItem

type FeynmanEvaluation = {
  understoodWell: string[]
  gaps: string[]
  clarification: string
  masteryScore: number
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

async function submitFeynmanCheck(moduleId: string, userExplanation: string): Promise<FeynmanEvaluation> {
  const res = await fetch('/api/feynman-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moduleId, userExplanation }),
  })

  if (!res.ok || !res.body) {
    throw new Error('Feynman check failed')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    fullText += decoder.decode(value, { stream: true })
  }

  return JSON.parse(fullText)
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
  const [explanation, setExplanation] = useState('')
  const [feynmanResult, setFeynmanResult] = useState<FeynmanEvaluation | null>(null)

    const searchParams = useSearchParams()
    const topicId = searchParams.get('topicId')

    async function fetchDueItems(): Promise<ReviewItem[]> {
        const url = topicId ? `/api/review/due?topicId=${topicId}` : '/api/review/due'
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch due items')
        return res.json()
    }

  const { data: items, isLoading } = useQuery({
    queryKey: ['review', 'due', 'session', topicId ?? 'all'], 
    queryFn: fetchDueItems,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })

  const reviewMutation = useMutation({
    mutationFn: ({ cardId, quality }: { cardId: string; quality: number }) =>
      submitReview(cardId, quality),
    onSuccess: () => {
      setIsRevealed(false)
      setCurrentIndex((prev) => prev + 1)
    },
  })

  const feynmanMutation = useMutation({
    mutationFn: ({ moduleId, userExplanation }: { moduleId: string; userExplanation: string }) =>
      submitFeynmanCheck(moduleId, userExplanation),
    onSuccess: (evaluation) => {
      setFeynmanResult(evaluation)
    },
  })

  function goToNext() {
    setFeynmanResult(null)
    setExplanation('')
    setIsRevealed(false)
    setCurrentIndex((prev) => prev + 1)
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center text-neutral-500">
        Loading your review session...
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">All caught up</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Nothing is due for review right now. Come back later.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          ← Back to dashboard
        </Link>
      </div>
    )
  }

  if (currentIndex >= items.length) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">Session complete</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          You reviewed {items.length} item{items.length > 1 ? 's' : ''}. Nice work.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          ← Back to dashboard
        </Link>
      </div>
    )
  }

  const currentItem = items[currentIndex]

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Card {currentIndex + 1} of {items.length}
        </p>
        <Link
          href="/dashboard"
          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          Exit session
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 p-8 dark:border-neutral-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
          {currentItem.topicTitle}
        </p>

        {currentItem.type === 'card' ? (
          <>
            <p className="mt-1 text-lg font-medium">{currentItem.question}</p>

            {isRevealed && (
              <p className="mt-4 border-t border-neutral-200 pt-4 text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
                {currentItem.answer}
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
                        reviewMutation.mutate({ cardId: currentItem.id, quality: value })
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
          </>
        ) : (
          <>
            <p className="mt-1 text-lg font-medium">{currentItem.moduleTitle}</p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Explain this concept in your own words.
            </p>

            {!feynmanResult ? (
              <>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={4}
                  className="mt-4 w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
                />
                <button
                  onClick={() =>
                    feynmanMutation.mutate({
                      moduleId: currentItem.moduleId,
                      userExplanation: explanation,
                    })
                  }
                  disabled={feynmanMutation.isPending || explanation.trim().length < 20}
                  className="mt-3 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {feynmanMutation.isPending ? 'Evaluating...' : 'Submit'}
                </button>
              </>
            ) : (
              <div className="mt-4">
                <p className="text-sm font-semibold">
                  Mastery score: {feynmanResult.masteryScore}/100
                </p>

                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  What you got right
                </p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
                  {feynmanResult.understoodWell.map((item, k) => (
                    <li key={k}>{item}</li>
                  ))}
                </ul>

                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Gaps
                </p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
                  {feynmanResult.gaps.map((item, k) => (
                    <li key={k}>{item}</li>
                  ))}
                </ul>

                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Clarification
                </p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  {feynmanResult.clarification}
                </p>

                <button
                  onClick={goToNext}
                  className="mt-4 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                >
                  Continue
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}