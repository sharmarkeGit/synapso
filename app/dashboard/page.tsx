'use client'

import { useState } from 'react'

type Card = {
  question: string
  answer: string
}

type Module = {
  title: string
  content: string
  cards: Card[]
}

type Curriculum = {
  modules: Module[]
}

type FeynmanEvaluation = {
  understoodWell: string[]
  gaps: string[]
  clarification: string
  masteryScore: number
}

async function pollForTopicModules(topicTitle: string, maxAttempts = 5): Promise<{ id: string }[]> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch('/api/topics')
    const topics = await res.json()

    const match = topics.find((t: { title: string; modules: { id: string }[] }) => t.title === topicTitle)
    if (match && match.modules.length > 0) {
      return match.modules
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return []
}

export default function DashboardPage() {
  const [topicTitle, setTopicTitle] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [moduleIds, setModuleIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const [explanations, setExplanations] = useState<Record<number, string>>({})
  const [evaluations, setEvaluations] = useState<Record<number, FeynmanEvaluation>>({})
  const [checkingIndex, setCheckingIndex] = useState<number | null>(null)

  async function handleGenerate(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsGenerating(true)
    setError(null)
    setCurriculum(null)

    try {
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

      if (!res.body) {
        throw new Error('Generation failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
      }

      const parsed: Curriculum = JSON.parse(fullText)

      const savedModules = await pollForTopicModules(topicTitle)
      setModuleIds(savedModules.map((m) => m.id))

      setCurriculum(parsed)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Something went wrong while generating your curriculum.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleFeynmanCheck(moduleIndex: number, moduleId: string) {
    const userExplanation = explanations[moduleIndex]
    if (!userExplanation || userExplanation.trim().length < 20) return

    setCheckingIndex(moduleIndex)

    try {
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

      const parsed: FeynmanEvaluation = JSON.parse(fullText)
      setEvaluations((prev) => ({ ...prev, [moduleIndex]: parsed }))
    } catch (err) {
      console.error(err)
    } finally {
      setCheckingIndex(null)
    }
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
            disabled={isGenerating}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </p>
        )}

        {curriculum && (
          <div className="mt-10 space-y-6">
            {curriculum.modules.map((courseModule, i) => {
              const moduleId = moduleIds[i] ?? ''

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
                    {courseModule.cards.map((card, j) => (
                      <li key={j} className="text-sm">
                        <p className="font-medium">{card.question}</p>
                        <p className="mt-1 text-neutral-600 dark:text-neutral-400">{card.answer}</p>
                      </li>
                    ))}
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