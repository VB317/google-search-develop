import { Index, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { useThrottleFn } from 'solidjs-use'
import { generateSignature } from '@/utils/auth'
import IconClear from './icons/Clear'
import IconX from './icons/X'
import Picture from './icons/Picture'
import MessageItem from './MessageItem'
import ErrorMessageItem from './ErrorMessageItem'
import type { ChatMessage, ErrorMessage } from '@/types'

export default () => {
  const EXPORT_CONFIG_KEY = 'chatExportConfig'
  const DEFAULT_PAIR_COUNT = 1
  const DEFAULT_EXPORT_ALL = false
  const TOC_LABEL_MAX = 72

  let inputRef: HTMLTextAreaElement
  const [messageList, setMessageList] = createSignal<ChatMessage[]>([])
  const [currentError, setCurrentError] = createSignal<ErrorMessage>()
  const [currentAssistantMessage, setCurrentAssistantMessage] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [controller, setController] = createSignal<AbortController>(null)
  const [isStick, setStick] = createSignal(false)
  const [showComingSoon, setShowComingSoon] = createSignal(false)
  const [exportNotice, setExportNotice] = createSignal('')
  const [isTocOpen, setIsTocOpen] = createSignal(false)
  const maxHistoryMessages = parseInt(import.meta.env.PUBLIC_MAX_HISTORY_MESSAGES || '99')

  const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim()
  const truncateText = (value: string, max: number) => {
    if (value.length <= max)
      return value
    return `${value.slice(0, max - 1).trimEnd()}…`
  }

  const escapeHtml = (value: string) => {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  const questionMetaByMessageIndex = createMemo(() => {
    const meta: Record<number, { id: string, number: number }> = {}
    let questionNumber = 0

    messageList().forEach((message, index) => {
      if (message.role === 'user') {
        questionNumber++
        meta[index] = {
          id: `q-${questionNumber}`,
          number: questionNumber,
        }
      }
    })

    return meta
  })

  const tocItems = createMemo(() => {
    const items: Array<{ id: string, number: number, label: string }> = []
    const meta = questionMetaByMessageIndex()
    const messages = messageList() as unknown as Array<{ role: string, content: string }>

    messages.forEach((message, index) => {
      if (message.role === 'user' && meta[index]) {
        const label = truncateText(normalizeText(message.content), TOC_LABEL_MAX)
        items.push({
          id: meta[index].id,
          number: meta[index].number,
          label: label || `Question ${meta[index].number}`,
        })
      }
    })

    return items
  })

  createEffect(() => (isStick() && smoothToBottom()))

  onMount(() => {
    let lastPostion = window.scrollY

    window.addEventListener('scroll', () => {
      const nowPostion = window.scrollY
      nowPostion < lastPostion && setStick(false)
      lastPostion = nowPostion
    })

    try {
      if (localStorage.getItem('messageList'))
        setMessageList(JSON.parse(localStorage.getItem('messageList')))

      if (localStorage.getItem('stickToBottom') === 'stick')
        setStick(true)
    } catch (err) {
      console.error(err)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    onCleanup(() => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    })
  })

  const handleBeforeUnload = () => {
    localStorage.setItem('messageList', JSON.stringify(messageList()))
    isStick() ? localStorage.setItem('stickToBottom', 'stick') : localStorage.removeItem('stickToBottom')
  }

  const handleButtonClick = async() => {
    const inputValue = inputRef.value
    if (!inputValue)
      return

    inputRef.value = ''
    setMessageList([
      ...messageList(),
      {
        role: 'user',
        content: inputValue,
      },
    ])
    requestWithLatestMessage()
    instantToBottom()
  }

  const smoothToBottom = useThrottleFn(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }, 300, false, true)

  const instantToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })
  }

  // ? Interim Solution
  // ensure that the user and the model have a one-to-one conversation and avoid any errors like:
  // "Please ensure that multiturn requests ends with a user role or a function response."
  // convert the raw list into data that conforms to the interface api rules
  const convertReqMsgList = (originalMsgList: ChatMessage[]) => {
    return originalMsgList.filter((curMsg, i, arr) => {
      // Check if there is a next message
      const nextMsg = arr[i + 1]
      // Include the current message if there is no next message or if the roles are different
      return !nextMsg || curMsg.role !== nextMsg.role
    })
  }
  const requestWithLatestMessage = async() => {
    setLoading(true)
    setCurrentAssistantMessage('')
    setCurrentError(null)
    const storagePassword = localStorage.getItem('pass')
    try {
      const controller = new AbortController()
      setController(controller)
      const requestMessageList = messageList().map(message => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })).slice(-maxHistoryMessages)
      const timestamp = Date.now()
      const response = await fetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          messages: convertReqMsgList(requestMessageList),
          time: timestamp,
          pass: storagePassword,
          sign: await generateSignature({
            t: timestamp,
            m: requestMessageList?.[requestMessageList.length - 1]?.parts[0]?.text || '',
          }),
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const error = await response.json()
        console.error(error.error)
        setCurrentError(error.error)
        throw new Error('Request failed')
      }
      const data = response.body
      if (!data)
        throw new Error('No data')

      const reader = data.getReader()
      const decoder = new TextDecoder('utf-8')
      let done = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        if (value) {
          const char = decoder.decode(value, { stream: true })
          if (char === '\n' && currentAssistantMessage().endsWith('\n'))
            continue

          if (char)
            setCurrentAssistantMessage(currentAssistantMessage() + char)

          isStick() && instantToBottom()
        }
        done = readerDone
      }
      if (done)
        setCurrentAssistantMessage(currentAssistantMessage() + decoder.decode())
    } catch (e) {
      console.error(e)
      setLoading(false)
      setController(null)
      return
    }
    archiveCurrentMessage()
    isStick() && instantToBottom()
  }

  const archiveCurrentMessage = () => {
    if (currentAssistantMessage()) {
      setMessageList([
        ...messageList(),
        {
          role: 'assistant',
          content: currentAssistantMessage(),
        },
      ])
      setCurrentAssistantMessage('')
      setLoading(false)
      setController(null)
      // Disable auto-focus on touch devices
      if (!('ontouchstart' in document.documentElement || navigator.maxTouchPoints > 0))
        inputRef.focus()
    }
  }

  const clear = () => {
    inputRef.value = ''
    inputRef.style.height = 'auto'
    setMessageList([])
    setCurrentAssistantMessage('')
    setCurrentError(null)
  }

  const stopStreamFetch = () => {
    if (controller()) {
      controller().abort()
      archiveCurrentMessage()
    }
  }

  const retryLastFetch = () => {
    if (messageList().length > 0) {
      const lastMessage = messageList()[messageList().length - 1]
      if (lastMessage.role === 'assistant')
        setMessageList(messageList().slice(0, -1))
      requestWithLatestMessage()
    }
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.isComposing || e.shiftKey)
      return

    if (e.key === 'Enter') {
      e.preventDefault()
      handleButtonClick()
    }
  }

  const handlePictureUpload = () => {
    // coming soon
    setShowComingSoon(true)
  }

  const clearExportNotice = () => {
    setTimeout(() => {
      setExportNotice('')
    }, 2000)
  }

  const getExportConfig = () => {
    try {
      const raw = localStorage.getItem(EXPORT_CONFIG_KEY)
      if (!raw)
        return { pairCount: DEFAULT_PAIR_COUNT, exportAll: DEFAULT_EXPORT_ALL }

      const parsed = JSON.parse(raw)
      const pairCount = Number(parsed?.pairCount)
      const exportAll = Boolean(parsed?.exportAll)
      if (String(pairCount).indexOf('.') !== -1 || isNaN(pairCount) || pairCount < 1)
        return { pairCount: DEFAULT_PAIR_COUNT, exportAll }

      return { pairCount, exportAll }
    } catch {
      return { pairCount: DEFAULT_PAIR_COUNT, exportAll: DEFAULT_EXPORT_ALL }
    }
  }

  const toDateCompact = (date: Date) => {
    const pad2 = (value: number) => (value < 10 ? `0${value}` : String(value))
    const yyyy = String(date.getFullYear())
    const mm = pad2(date.getMonth() + 1)
    const dd = pad2(date.getDate())
    const hh = pad2(date.getHours())
    const min = pad2(date.getMinutes())
    return `${yyyy}${mm}${dd}-${hh}${min}`
  }

  const getCompletePairs = () => {
    const pairs: { question: string, answer: string }[] = []
    const messages = messageList() as Array<{ role: string, content: string }>

    for (let i = 0; i < messages.length - 1; i++) {
      const current = messages[i]
      const next = messages[i + 1]

      if (current.role === 'user' && next.role === 'assistant') {
        pairs.push({
          question: current.content,
          answer: next.content,
        })
        i++
      }
    }

    return pairs
  }

  const normalizeAnswerHeadings = (answer: string) => {
    return answer.replace(/^(#{1,6})(\s+)/gm, (_match, hashes: string, spaces: string) => {
      const currentLevel = hashes.length
      const nestedLevel = currentLevel + 3 > 6 ? 6 : currentLevel + 3
      let nestedHashes = ''
      for (let i = 0; i < nestedLevel; i++)
        nestedHashes += '#'

      return `${nestedHashes}${spaces}`
    })
  }

  const buildExportToc = (pairs: { question: string }[]) => {
    if (!pairs.length)
      return [] as string[]

    const toc: string[] = [
      '<details class="qa-toc-panel">',
      '<summary>Questions navigation</summary>',
      '<nav class="qa-toc-links">',
      '<ul>',
    ]

    pairs.forEach((pair, index) => {
      const questionNumber = index + 1
      const id = `q-${questionNumber}`
      const label = truncateText(normalizeText(pair.question), TOC_LABEL_MAX)
      const safeLabel = escapeHtml(label || `Question ${questionNumber}`)
      toc.push(`<li><a href="#${id}">Q${questionNumber}. ${safeLabel}</a></li>`)
    })

    toc.push('</ul>')
    toc.push('</nav>')
    toc.push('</details>')
    toc.push('')

    return toc
  }

  const buildExportMarkdown = (pairs: { question: string, answer: string }[]) => {
    const now = new Date()
    const header = [
      '# Chat Export',
      '',
      `- Generated at: ${now.toISOString()}`,
      `- Exported pairs: ${pairs.length}`,
      `- Source: ${window.location.origin}`,
      '',
    ]

    const tocBlock = buildExportToc(pairs)

    const content: string[] = []
    pairs.forEach((pair, index) => {
      const questionNumber = index + 1
      const questionId = `q-${questionNumber}`
      content.push(`## Pair ${questionNumber}`)
      content.push('')
      content.push(`<p id="${questionId}" class="qa-question-line"><a class="qa-question-tag" href="#${questionId}">#Q${questionNumber}</a> ${escapeHtml(pair.question)}</p>`)
      content.push('')
      content.push('### Answer')
      content.push('')
      content.push(normalizeAnswerHeadings(pair.answer))
      content.push('')
    })

    return [...header, ...tocBlock, ...content].join('\n')
  }

  const scrollToQuestion = (id: string) => {
    const target = document.getElementById(id)
    if (!target)
      return

    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (window.history && window.history.replaceState)
      window.history.replaceState(null, '', `#${id}`)
  }

  const downloadMarkdown = () => {
    const exportConfig = getExportConfig()
    const completePairs = getCompletePairs()
    if (!completePairs.length) {
      setExportNotice('No complete Q&A pair to export')
      clearExportNotice()
      return
    }

    const selectedPairs = exportConfig.exportAll
      ? completePairs
      : completePairs.slice(-exportConfig.pairCount)
    const markdown = buildExportMarkdown(selectedPairs)
    const filename = `chat-export-${toDateCompact(new Date())}.md`

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)

    setExportNotice(`Exported ${selectedPairs.length} pair(s)`)
    clearExportNotice()
  }

  return (
    <div my-6>
      <Show when={tocItems().length > 0}>
        <aside class="qa-toc-web" classList={{ 'is-open': isTocOpen() }}>
          <button
            type="button"
            class="qa-toc-toggle"
            aria-expanded={isTocOpen()}
            onClick={() => setIsTocOpen(!isTocOpen())}
          >
            {isTocOpen() ? 'Hide questions' : `Questions (${tocItems().length})`}
          </button>
          <Show when={isTocOpen()}>
            <nav class="qa-toc-nav" aria-label="Question navigation">
              <Index each={tocItems()}>
                {item => (
                  <a
                    class="qa-toc-link"
                    href={`#${item().id}`}
                    onClick={(event) => {
                      event.preventDefault()
                      scrollToQuestion(item().id)
                      setIsTocOpen(false)
                    }}
                  >
                    <span class="qa-toc-link-number">Q{item().number}.</span>
                    <span class="qa-toc-link-text">{item().label}</span>
                  </a>
                )}
              </Index>
            </nav>
          </Show>
        </aside>
      </Show>

      {/* beautiful coming soon alert box, position: fixed, screen center, no transparent background, z-index 100*/}
      <Show when={showComingSoon()}>
        <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-100">
          <div class="bg-white rounded-md shadow-md p-6">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-medium">Coming soon</h3>
              <button onClick={() => setShowComingSoon(false)}>
                <IconX />
              </button>
            </div>
            <p class="text-gray-500 mt-2">Chat with picture is coming soon!</p>
          </div>
        </div>
      </Show>

      <Index each={messageList()}>
        {(message, index) => {
          const questionMeta = () => questionMetaByMessageIndex()[index]
          return (
            <div
              id={message().role === 'user' ? questionMeta()?.id : undefined}
            >
              <Show when={message().role === 'user'}>
                <div class="qa-question-meta">
                  <a
                    class="qa-question-tag"
                    href={`#${questionMeta()?.id}`}
                    onClick={(event) => {
                      event.preventDefault()
                      if (questionMeta()?.id) {
                        scrollToQuestion(questionMeta().id)
                        setIsTocOpen(false)
                      }
                    }}
                  >
                    #Q{questionMeta()?.number}
                  </a>
                </div>
              </Show>
              <MessageItem
                role={message().role}
                message={message().content}
                showRetry={() => (message().role === 'assistant' && index === messageList().length - 1)}
                onRetry={retryLastFetch}
              />
            </div>
          )
        }}
      </Index>
      {currentAssistantMessage() && (
        <MessageItem
          role="assistant"
          message={currentAssistantMessage}
        />
      )}
      {currentError() && <ErrorMessageItem data={currentError()} onRetry={retryLastFetch} />}
      <Show
        when={!loading()}
        fallback={() => (
          <div class="gen-cb-wrapper">
            <span>I'm searching...</span>
            <div class="gen-cb-stop" onClick={stopStreamFetch}>Stop</div>
          </div>
        )}
      >
        <div class="gen-text-wrapper relative">
          <button title="Picture" onClick={handlePictureUpload} class="absolute left-1rem top-50% translate-y-[-50%]">
            <Picture />
          </button>
          <textarea
            ref={inputRef!}
            onKeyDown={handleKeydown}
            placeholder="Enter something..."
            autocomplete="off"
            autofocus
            onInput={() => {
              inputRef.style.height = 'auto'
              inputRef.style.height = `${inputRef.scrollHeight}px`
            }}
            rows="1"
            class="gen-textarea"
          />
          <button onClick={handleButtonClick} gen-slate-btn>
            Send
          </button>
          <button title="Clear" onClick={clear} gen-slate-btn>
            <IconClear />
          </button>
          <button title="Config" onClick={() => { window.location.href = '/config' }} gen-slate-btn>
            Config
          </button>
          <button title="Download Markdown" onClick={downloadMarkdown} gen-slate-btn>
            <div i-carbon-download />
          </button>
        </div>
        {exportNotice() && (
          <div class="mt-2 text-sm op-75">{exportNotice()}</div>
        )}
      </Show>
      {/* <div class="fixed bottom-5 left-5 rounded-md hover:bg-slate/10 w-fit h-fit transition-colors active:scale-90" class:stick-btn-on={isStick()}>
        <div>
          <button class="p-2.5 text-base" title="stick to bottom" type="button" onClick={() => setStick(!isStick())}>
            <div i-ph-arrow-line-down-bold />
          </button>
        </div>
      </div> */}
    </div>
  )
}
