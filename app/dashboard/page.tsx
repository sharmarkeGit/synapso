'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

type FeynmanEvaluation = {
  understoodWell: string[]
  gaps: string[]
  clarification: string
  masteryScore: number
}

type ModuleWithId = {
    id: string
    title: string
    content: string
    cards: { id: string; question: string; answer: string }[]
  }
  
  async function generateCurriculum(topicTitle: string): Promise<ModuleWithId[]> {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicTitle }),
    })
  
    if (!res.ok) {
      if (res.status === 403) {
        const data = await res.json()
        throw new Error(data.error)
      }
      throw new Error('Generation failed')
    }
  
    const data = await res.json()
    return data.modules
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

export default function DashboardPage() {
  const [topicTitle, setTopicTitle] = useState('')

  const [explanations, setExplanations] = useState<Record<number, string>>({})
  const [evaluations, setEvaluations] = useState<Record<number, FeynmanEvaluation>>({})
  const [checkingIndex, setCheckingIndex] = useState<number | null>(null)
  const [modules, setModules] = useState<ModuleWithId[]>([])
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set())

  const queryClient = useQueryClient()

  const generateMutation = useMutation({
    mutationFn: generateCurriculum,
    onSuccess: (modules) => {
        setModules(modules)
        queryClient.invalidateQueries({ queryKey: ['topics'] })
      },
  })

  const feynmanMutation = useMutation({
    mutationFn: ({ moduleId, userExplanation }: { moduleId: string; userExplanation: string }) =>
      submitFeynmanCheck(moduleId, userExplanation),
  })

  function handleGenerate(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setModules([])
    generateMutation.mutate(topicTitle)
  }

  function handleFeynmanCheck(moduleIndex: number, moduleId: string) {
    const userExplanation = explanations[moduleIndex]
    if (!userExplanation || userExplanation.trim().length < 20) return

    setCheckingIndex(moduleIndex)

    feynmanMutation.mutate(
      { moduleId, userExplanation },
      {
        onSuccess: (evaluation) => {
          setEvaluations((prev) => ({ ...prev, [moduleIndex]: evaluation }))
        },
        onSettled: () => {
          setCheckingIndex(null)
        },
      }
    )
  }

  function toggleReveal(cardKey: string) {
    setRevealedCards((prev) => {
      const next = new Set(prev)
      if (next.has(cardKey)) {
        next.delete(cardKey)
      } else {
        next.add(cardKey)
      }
      return next
    })
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Synapso</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Enter a topic and get a curriculum built on retrieval practice, spaced repetition, and interleaving.
        </p>

        <form onSubmit={handleGenerate} className="mt-8 flex gap-3">
          <input
            value={topicTitle}
            onChange={(e) => setTopicTitle(e.target.value)}
            placeholder="e.g. Photosynthesis"
            required
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="submit"
            disabled={generateMutation.isPending}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generateMutation.isPending ? 'Generating...' : 'Generate'}
          </button>
        </form>

        {generateMutation.isError && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {generateMutation.error instanceof Error
              ? generateMutation.error.message
              : 'Something went wrong while generating your curriculum.'}
          </p>
        )}

        {modules.length > 0 && (
          <div className="mt-10 space-y-6">
            {modules.map((courseModule, i) => {
              const moduleId = courseModule.id

              return (
                <div
                  key={i}
                  className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800"
                >
                  <h2 className="text-lg font-semibold">{courseModule.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                    {courseModule.content}
                  </p>

                  <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Recall questions
                  </h3>
                  <ul className="mt-3 space-y-3">
                    {courseModule.cards.map((card, j) => {
                      const cardKey = `${i}-${j}`
                      const isRevealed = revealedCards.has(cardKey)
                    
                      return (
                        <li key={j} className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
                          <p className="font-medium">{card.question}</p>
                          {isRevealed ? (
                            <p className="mt-2 text-neutral-600 dark:text-neutral-400">{card.answer}</p>
                          ) : (
                            <button
                              onClick={() => toggleReveal(cardKey)}
                              className="mt-2 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                            >
                              Show answer
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>

                  <div className="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-800">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      Feynman Check
                    </h3>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                      Explain this concept in your own words.
                    </p>
                    <textarea
                      value={explanations[i] || ''}
                      onChange={(e) =>
                        setExplanations((prev) => ({ ...prev, [i]: e.target.value }))
                      }
                      rows={4}
                      className="mt-3 w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
                    />
                    <button
                      onClick={() => handleFeynmanCheck(i, moduleId)}
                      disabled={checkingIndex === i || !moduleId}
                      className="mt-3 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                    >
                      {checkingIndex === i ? 'Checking...' : 'Check my understanding'}
                    </button>

                    {evaluations[i] && (
                      <div className="mt-4 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-900">
                        <p className="text-sm font-semibold">
                          Mastery score: {evaluations[i].masteryScore}/100
                        </p>

                        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                          What you got right
                        </p>
                        <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
                          {evaluations[i].understoodWell.map((item, k) => (
                            <li key={k}>{item}</li>
                          ))}
                        </ul>

                        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                          Gaps
                        </p>
                        <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
                          {evaluations[i].gaps.map((item, k) => (
                            <li key={k}>{item}</li>
                          ))}
                        </ul>

                        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                          Clarification
                        </p>
                        <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                          {evaluations[i].clarification}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}