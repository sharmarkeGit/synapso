'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'


type ModuleWithId = {
  id: string
  title: string
  content: string
  cards: { id: string; question: string; answer: string }[]
}

type Topic = {
  id: string
  title: string
  createdAt: string
  modules: ModuleWithId[]
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


async function fetchTopics(): Promise<Topic[]> {
  const res = await fetch('/api/topics')
  if (!res.ok) throw new Error('Failed to fetch topics')
  return res.json()
}

async function fetchDueItems(): Promise<{ type: string; topicTitle: string }[]> {
  const res = await fetch('/api/review/due?countOnly=true')
  if (!res.ok) throw new Error('Failed to fetch due items')
  return res.json()
}



export default function DashboardPage() {
  const [topicTitle, setTopicTitle] = useState('')
  const [modules, setModules] = useState<ModuleWithId[]>([])
  const [activeTitle, setActiveTitle] = useState<string | null>(null)

  const [activeTopicId, setActiveTopicId] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const { data: topics } = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
  })

  const { data: dueItems } = useQuery({
  queryKey: ['review', 'due', 'count'], 
  queryFn: fetchDueItems,
})

const dueCount = dueItems?.length ?? 0

function dueCountForTopic(topicTitle: string) {
  return dueItems?.filter((item) => item.topicTitle === topicTitle).length ?? 0
}

  const generateMutation = useMutation({
    mutationFn: generateCurriculum,
    onSuccess: (newModules) => {
      setModules(newModules)
      setActiveTitle(topicTitle)
      setActiveTopicId(null)
      setTopicTitle('')
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      queryClient.invalidateQueries({ queryKey: ['review', 'due', 'count'] }) 

      setTimeout(() => {
      document.getElementById('active-topic')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
    },
  })


  function handleGenerate(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setModules([])
    setActiveTitle(null)
    setActiveTopicId(null)
    generateMutation.mutate(topicTitle)
  }

  function openTopic(topic: Topic) {
  setModules(topic.modules)
  setActiveTitle(topic.title)
  setActiveTopicId(topic.id)

  setTimeout(() => {
    document.getElementById('active-topic')?.scrollIntoView({ behavior: 'smooth' })
  }, 0)
}

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Synapso</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Enter a topic and get a curriculum built on retrieval practice, spaced repetition, and interleaving.
        </p>

        {dueCount !== undefined && dueCount > 0 && (
          <Link
            href="/review"
            className="mt-6 flex items-center justify-between rounded-lg bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
          >
            <span>{dueCount} card{dueCount > 1 ? 's' : ''} due for review</span>
            <span>Start review →</span>
          </Link>
        )}

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

        {topics && topics.length > 0 && (
  <div className="mt-10">
    <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
      Your topics
    </h2>
    <div className="relative mt-3">
      <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
  {topics.map((topic) => {
    const topicDueCount = dueCountForTopic(topic.title)

    return (
      <li key={topic.id} className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <button
          onClick={() => openTopic(topic)}
            className={`flex-1 text-left text-sm ${
            activeTopicId === topic.id ? 'font-semibold text-indigo-600 dark:text-indigo-400' : ''
            }`}
      >
  <span className="font-medium">{topic.title}</span>
  <span className="ml-2 text-neutral-500">
    {topic.modules.length} module{topic.modules.length > 1 ? 's' : ''}
    {topicDueCount > 0 && ` · ${topicDueCount} due`}
  </span>
</button>
        {topicDueCount > 0 ? (
          <Link
            href={`/review?topicId=${topic.id}`}
            className="ml-3 rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300"
          >
            Review
          </Link>
        ) : (
          <span className="ml-3 rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-400 dark:border-neutral-800">
            Review
          </span>
        )}
      </li>
    )
  })}
</ul>
      {topics.length > 4 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent dark:from-neutral-950" />
      )}
    </div>
  </div>
)}
        {generateMutation.isPending && (
          <div className="mt-10 text-center text-sm text-neutral-500">
            Generating your curriculum...
          </div>
        )}

        {!generateMutation.isPending && modules.length > 0 && (
          <div id="active-topic" className="mt-10 space-y-6">
            {activeTitle && (
              <h2 className="text-xl font-bold">{activeTitle}</h2>
            )}
            {modules.map((courseModule) => (
                <div
                  key={courseModule.id}
                  className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800"
                >
                  <h2 className="text-lg font-semibold">{courseModule.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                    {courseModule.content}
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}