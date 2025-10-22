import { useState } from 'react'
import { askChatGPT } from '../../services/chatgptApi'
import { useFPLStore } from '../../store/fplStore'


export default function ChatPanel() {
    const [input, setInput] = useState('')
    const [busy, setBusy] = useState(false)
    const [history, setHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
    const { bootstrap, currentEvent, fixtures } = useFPLStore()


    async function send() {
        if (!input.trim()) return
        const next = [...history, { role: 'user' as const, content: input }]
        setHistory(next)
        setBusy(true)
        try {
            const resp = await askChatGPT({
                messages: next,
                toolsContext: {
                    currentGW: currentEvent?.id,
                    fixtures,
                    players: bootstrap?.elements?.slice(0, 300), // trim context volume
                },
            })
            setHistory([...next, { role: 'assistant', content: resp.text }])
        } catch (e: any) {
            setHistory([...next, { role: 'assistant', content: `Error: ${e?.message ?? 'failed'}` }])
        } finally {
            setBusy(false)
            setInput('')
        }
    }


    return (
        <div className="rounded-2xl border border-zinc-800 p-4 bg-zinc-900/50 h-full flex flex-col">
            <h3 className="text-lg font-semibold mb-3">FPL Assistant</h3>
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {history.map((m, i) => (
                    <div key={i} className={m.role === 'user' ? 'text-zinc-100' : 'text-emerald-300'}>
                        <div className="text-xs uppercase tracking-wide opacity-60">{m.role}</div>
                        <div className="prose prose-invert text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                    </div>
                ))}
            </div>
            <div className="mt-3 flex gap-2">
                <input
                    className="flex-1 bg-zinc-800 border-zinc-700 rounded-xl text-sm"
                    placeholder="Ask about fixtures, best picks, captaincy…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !busy ? send() : undefined}
                />
                <button disabled={busy} onClick={send} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm disabled:opacity-60">
                    {busy ? 'Sending...' : 'Send'}
                </button>
            </div>
        </div>
    )
}


// tiny markdown: support line breaks and bullet-ish
function renderMarkdown(text: string) {
    const withBreaks = text
        .replace(/\n\n/g, '<br/><br/>')
        .replace(/^\-\s(.+)$/gm, '• $1')
    return withBreaks
}