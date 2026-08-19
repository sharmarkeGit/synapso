'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type ModuleWithId = {
  id: string;
  title: string;
  content: string;
  cards: { id: string; question: string; answer: string }[];
};

type Topic = {
  id: string;
  title: string;
  createdAt: string;
  modules: ModuleWithId[];
};

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A1.75 1.75 0 007 2.75V3H3.75a.75.75 0 000 1.5h.5l.62 10.13A2.75 2.75 0 007.61 17h4.78a2.75 2.75 0 002.74-2.37L15.75 4.5h.5a.75.75 0 000-1.5H13v-.25A1.75 1.75 0 0011.25 1h-2.5zM11 3H9v-.25a.25.25 0 01.25-.25h1.5a.25.25 0 01.25.25V3zM6.75 6.5a.75.75 0 01.75.75v5.5a.75.75 0 01-1.5 0v-5.5a.75.75 0 01.75-.75zm3 0a.75.75 0 01.75.75v5.5a.75.75 0 01-1.5 0v-5.5a.75.75 0 01.75-.75zm3 0a.75.75 0 01.75.75v5.5a.75.75 0 01-1.5 0v-5.5a.75.75 0 01.75-.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ConfirmDeleteDialog({
  topic,
  isPending,
  onCancel,
  onConfirm,
}: {
  topic: Topic;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl"
      >
        <h2 id="confirm-delete-title" className="text-base font-semibold text-neutral-100">
          Delete &quot;{topic.title}&quot;?
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          This removes all its modules and cards. This can&apos;t be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-300 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending && <Spinner className="h-4 w-4" />}
            {isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

const GENERATION_MESSAGES = [
  'Structuring your curriculum...',
  'Writing modules...',
  'Building recall questions...',
  'Almost there...',
];

async function generateCurriculum(topicTitle: string): Promise<ModuleWithId[]> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicTitle }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const error = new Error(data?.error ?? 'Generation failed') as Error & { code?: string };
    error.code = data?.code;
    throw error;
  }

  const data = await res.json();
  return data.modules;
}

async function fetchTopics(): Promise<{ plan: string; topics: Topic[] }> {
  const res = await fetch('/api/topics');
  if (!res.ok) throw new Error('Failed to fetch topics');
  return res.json();
}

async function fetchDueItems(): Promise<{ type: string; topicTitle: string }[]> {
  const res = await fetch('/api/review/due?countOnly=true');
  if (!res.ok) throw new Error('Failed to fetch due items');
  return res.json();
}

async function deleteTopicRequest(topicId: string): Promise<void> {
  const res = await fetch(`/api/topics/${topicId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete topic');
}

export default function DashboardPage() {
  const [topicTitle, setTopicTitle] = useState('');
  const [modules, setModules] = useState<ModuleWithId[]>([]);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [genMsgIndex, setGenMsgIndex] = useState(0);
  const [confirmTopic, setConfirmTopic] = useState<Topic | null>(null);

  const queryClient = useQueryClient();

  const { data: topicData } = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
  });

  const topics = topicData?.topics;
  const userPlan = topicData?.plan;

  const { data: dueItems } = useQuery({
    queryKey: ['review', 'due', 'count'],
    queryFn: fetchDueItems,
  });

  const dueCount = dueItems?.length ?? 0;

  function dueCountForTopic(topicTitle: string) {
    return dueItems?.filter((item) => item.topicTitle === topicTitle).length ?? 0;
  }

  const generateMutation = useMutation({
    mutationFn: generateCurriculum,
    onMutate: () => {
      setGenMsgIndex(0);
    },
    onSuccess: (newModules) => {
      setModules(newModules);
      setActiveTitle(topicTitle);
      setActiveTopicId(null);
      setTopicTitle('');
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['review', 'due', 'count'] });

      setTimeout(() => {
        document.getElementById('active-topic')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    },
  });

  // Cycle reassuring status messages while a curriculum is generating, since a
  // cache-miss LLM call can take 30-40s and a static label reads as frozen.
  // The index resets in onMutate above (the action that starts the wait),
  // not here — this effect only subscribes to the interval while pending.
  useEffect(() => {
    if (!generateMutation.isPending) return;
    const interval = setInterval(() => {
      setGenMsgIndex((i) => (i + 1) % GENERATION_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [generateMutation.isPending]);

  const deleteMutation = useMutation({
    mutationFn: deleteTopicRequest,
    onSuccess: (_data, deletedTopicId) => {
      if (activeTopicId === deletedTopicId) {
        setModules([]);
        setActiveTitle(null);
        setActiveTopicId(null);
      }
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['review', 'due', 'count'] });
    },
  });

  function handleDelete(topic: Topic) {
    setConfirmTopic(topic);
  }

  function confirmDelete() {
    if (!confirmTopic) return;
    deleteMutation.mutate(confirmTopic.id);
    setConfirmTopic(null);
  }

  function handleGenerate(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setModules([]);
    setActiveTitle(null);
    setActiveTopicId(null);
    generateMutation.mutate(topicTitle);
  }

  function openTopic(topic: Topic) {
    setModules(topic.modules);
    setActiveTitle(topic.title);
    setActiveTopicId(topic.id);

    setTimeout(() => {
      document.getElementById('active-topic')?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
  }

  async function startCheckout(): Promise<{ url: string }> {
    const res = await fetch('/api/checkout', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to start checkout');
    return res.json();
  }

  const upgradeMutation = useMutation({
    mutationFn: startCheckout,
    onSuccess: (data) => {
      window.open(data.url, '_blank');
    },
  });

  const generateError = generateMutation.error as (Error & { code?: string }) | null;
  const isInvalidTopicError = generateError?.code === 'INVALID_TOPIC';
  const isPlanLimitError = generateError?.code === 'PLAN_LIMIT_REACHED';

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Synapso</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Enter a topic and get a curriculum built on retrieval practice, spaced repetition, and
          interleaving.
        </p>
        {userPlan === 'free' && (
          <button
            onClick={() => upgradeMutation.mutate()}
            disabled={upgradeMutation.isPending}
            className="mt-4 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {upgradeMutation.isPending ? 'Redirecting...' : 'Upgrade to Pro →'}
          </button>
        )}
        {dueCount !== undefined && dueCount > 0 && (
          <Link
            href="/review"
            className="mt-6 flex items-center justify-between rounded-lg bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
          >
            <span>
              {dueCount} card{dueCount > 1 ? 's' : ''} due for review
            </span>
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
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generateMutation.isPending && <Spinner />}
            {generateMutation.isPending ? 'Generating...' : 'Generate'}
          </button>
        </form>

        {generateMutation.isError && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              isInvalidTopicError
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
            }`}
          >
            <p>
              {generateError?.message ?? 'Something went wrong while generating your curriculum.'}
            </p>
            {isInvalidTopicError && (
              <p className="mt-1 text-xs opacity-80">Try a clearer, more specific topic.</p>
            )}
            {isPlanLimitError && (
              <button
                onClick={() => upgradeMutation.mutate()}
                disabled={upgradeMutation.isPending}
                className="mt-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {upgradeMutation.isPending ? 'Redirecting...' : 'Upgrade to Pro'}
              </button>
            )}
          </div>
        )}

        {topics && topics.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Your topics
            </h2>
            <div className="relative mt-3">
              <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {topics.map((topic) => {
                  const topicDueCount = dueCountForTopic(topic.title);
                  const isDeleting =
                    deleteMutation.isPending && deleteMutation.variables === topic.id;

                  return (
                    <li
                      key={topic.id}
                      className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800"
                    >
                      <button
                        onClick={() => openTopic(topic)}
                        className={`flex-1 text-left text-sm ${
                          activeTopicId === topic.id
                            ? 'font-semibold text-indigo-600 dark:text-indigo-400'
                            : ''
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
                          href={`/review?topicId=${topic.id}&title=${encodeURIComponent(topic.title)}`}
                          className="ml-3 rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300"
                        >
                          Review
                        </Link>
                      ) : (
                        <span className="ml-3 rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-400 dark:border-neutral-800">
                          Review
                        </span>
                      )}
                      <button
                        onClick={() => handleDelete(topic)}
                        disabled={isDeleting}
                        aria-label={`Delete ${topic.title}`}
                        title={`Delete ${topic.title}`}
                        className="ml-2 rounded-md p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/40"
                      >
                        {isDeleting ? <Spinner className="h-4 w-4" /> : <TrashIcon />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {topics.length > 4 && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent dark:from-neutral-950" />
              )}
            </div>
          </div>
        )}
        {generateMutation.isPending && (
          <div className="mt-10 flex flex-col items-center gap-2 text-center text-sm text-neutral-500">
            <Spinner className="h-5 w-5" />
            <span>{GENERATION_MESSAGES[genMsgIndex]}</span>
          </div>
        )}

        {!generateMutation.isPending && modules.length > 0 && (
          <div id="active-topic" className="mt-10 space-y-6">
            {activeTitle && <h2 className="text-xl font-bold">{activeTitle}</h2>}
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
            ))}
          </div>
        )}
      </div>

      {confirmTopic && (
        <ConfirmDeleteDialog
          topic={confirmTopic}
          isPending={deleteMutation.isPending && deleteMutation.variables === confirmTopic.id}
          onCancel={() => setConfirmTopic(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
