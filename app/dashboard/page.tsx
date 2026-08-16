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
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 40 }}>
      <h1>Synapso</h1>
      <p>Enter a topic and get a curriculum built on retrieval practice, spaced repetition, and interleaving.</p>

      <form onSubmit={handleGenerate} style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        <input
          value={topicTitle}
          onChange={(e) => setTopicTitle(e.target.value)}
          placeholder="e.g. Photosynthesis"
          required
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {curriculum && (
        <div>
          {curriculum.modules.map((courseModule, i) => {
            const moduleId = moduleIds[i] ?? ''

            return (
              <div key={i} style={{ marginBottom: 32, border: '1px solid #333', padding: 16, borderRadius: 8 }}>
                <h2>{courseModule.title}</h2>
                <p>{courseModule.content}</p>

                <h3>Recall questions</h3>
                <ul>
                  {courseModule.cards.map((card, j) => (
                    <li key={j} style={{ marginBottom: 12 }}>
                      <strong>{card.question}</strong>
                      <br />
                      <span style={{ opacity: 0.7 }}>{card.answer}</span>
                    </li>
                  ))}
                </ul>

                <h3>Feynman Check</h3>
                <p style={{ fontSize: 14, opacity: 0.8 }}>
                  Explain this concept in your own words.
                </p>
                <textarea
                  value={explanations[i] || ''}
                  onChange={(e) =>
                    setExplanations((prev) => ({ ...prev, [i]: e.target.value }))
                  }
                  rows={4}
                  style={{ width: '100%', padding: 8, marginBottom: 8 }}
                />
                <button
                  onClick={() => handleFeynmanCheck(i, moduleId)}
                  disabled={checkingIndex === i || !moduleId}
                >
                  {checkingIndex === i ? 'Checking...' : 'Check my understanding'}
                </button>

                {evaluations[i] && (
                  <div style={{ marginTop: 16, padding: 12, background: '#111', borderRadius: 8 }}>
                    <p><strong>Mastery score: {evaluations[i].masteryScore}/100</strong></p>

                    <p style={{ marginTop: 8 }}><strong>What you got right:</strong></p>
                    <ul>
                      {evaluations[i].understoodWell.map((item, k) => (
                        <li key={k}>{item}</li>
                      ))}
                    </ul>

                    <p style={{ marginTop: 8 }}><strong>Gaps:</strong></p>
                    <ul>
                      {evaluations[i].gaps.map((item, k) => (
                        <li key={k}>{item}</li>
                      ))}
                    </ul>

                    <p style={{ marginTop: 8 }}><strong>Clarification:</strong></p>
                    <p>{evaluations[i].clarification}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}