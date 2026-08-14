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

export default function DashboardPage() {
  const [topicTitle, setTopicTitle] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [error, setError] = useState<string | null>(null)

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

      if (!res.ok || !res.body) {
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
      setCurriculum(parsed)
    } catch (err) {
      console.error(err)
      setError('Something went wrong while generating your curriculum.')
    } finally {
      setIsGenerating(false)
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
          {curriculum.modules.map((module, i) => (
            <div key={i} style={{ marginBottom: 32, border: '1px solid #333', padding: 16, borderRadius: 8 }}>
              <h2>{module.title}</h2>
              <p>{module.content}</p>
              <h3>Recall questions</h3>
              <ul>
                {module.cards.map((card, j) => (
                  <li key={j} style={{ marginBottom: 12 }}>
                    <strong>{card.question}</strong>
                    <br />
                    <span style={{ opacity: 0.7 }}>{card.answer}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}