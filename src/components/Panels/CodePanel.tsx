import { useEffect, useState } from 'react'
import { isTauri, listDir, readTextFile, type FsDirEntry } from '../../lib/tauri'

type FileEntry = Pick<FsDirEntry, 'name' | 'path'> & { isDir: boolean; size?: number }

const TEXT_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'rs', 'toml', 'json', 'md', 'css', 'html', 'sh', 'yaml', 'yml', 'txt', 'env', 'lock'])

function ext(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function langFromExt(e: string): string {
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    rs: 'rust', toml: 'toml', json: 'json', md: 'markdown',
    css: 'css', html: 'html', sh: 'bash', yaml: 'yaml', yml: 'yaml',
  }
  return map[e] ?? 'text'
}

async function readDirTauri(path: string): Promise<FileEntry[]> {
  const entries = await listDir(path)
  return entries.map((e) => ({ name: e.name, path: e.path, isDir: e.is_dir, size: e.size ?? undefined }))
}

async function readFileTauri(path: string): Promise<string> {
  return readTextFile(path)
}

export function CodePanel() {
  const [root] = useState(() => {
    if (typeof window !== 'undefined' && isTauri()) {
      return '/home/' + (window.navigator.userAgent.includes('Linux') ? 'kael/nexus-ai' : 'user')
    }
    return null
  })
  const [cwd, setCwd] = useState<string>(root ?? '')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<string[]>([])

  const loadDir = async (path: string) => {
    if (!isTauri()) return
    setLoading(true)
    setError(null)
    try {
      const list = await readDirTauri(path)
      setEntries(list)
      setCwd(path)
      // Update breadcrumb
      const parts = path.split('/').filter(Boolean)
      setBreadcrumb(parts)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const openFile = async (path: string) => {
    if (!isTauri()) return
    setLoading(true)
    setError(null)
    try {
      const content = await readFileTauri(path)
      setFileContent(content)
      setSelectedFile(path)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (root) loadDir(root)
  }, [root])

  const navigateUp = () => {
    const parts = cwd.split('/').filter(Boolean)
    if (parts.length <= 1) return
    parts.pop()
    loadDir('/' + parts.join('/'))
  }

  const navigateTo = (idx: number) => {
    const parts = cwd.split('/').filter(Boolean)
    const target = '/' + parts.slice(0, idx + 1).join('/')
    loadDir(target)
  }

  const lineCount = fileContent.split('\n').length

  if (!isTauri()) {
    return (
      <div className="section-panel">
        <div className="section-header">
          <span className="section-title">// CODE</span>
        </div>
        <div className="panel-empty">
          <span className="mat" style={{ fontSize: 40, color: 'var(--ghost)' }}>code</span>
          <div className="panel-empty-text">TAURI REQUIRED</div>
          <div className="panel-empty-hint">File browser is only available in the desktop app</div>
        </div>
      </div>
    )
  }

  return (
    <div className="section-panel">
      <div className="section-header">
        <span className="section-title">// CODE</span>
        <div className="code-breadcrumb">
          <button className="crumb-btn" onClick={() => loadDir(root ?? '/')}>~</button>
          {breadcrumb.map((part, i) => (
            <span key={i}>
              <span style={{ color: 'var(--outline)', margin: '0 2px' }}>/</span>
              <button className="crumb-btn" onClick={() => navigateTo(i)}>{part}</button>
            </span>
          ))}
        </div>
      </div>

      <div className="code-layout">
        {/* File tree */}
        <div className="code-tree">
          <div className="code-tree-header">
            <span className="panel-block-label" style={{ margin: 0 }}>FILES</span>
            {cwd !== root && (
              <button className="row-action-btn" onClick={navigateUp} title="Go up">
                <span className="mat mat-sm">arrow_upward</span>
              </button>
            )}
          </div>
          <div className="code-tree-list">
            {loading && !selectedFile && (
              <div style={{ color: 'var(--muted)', fontSize: 10, padding: 8 }}>Loading…</div>
            )}
            {entries.map((e) => (
              <button
                key={e.path}
                className={`code-tree-item ${selectedFile === e.path ? 'code-tree-item-active' : ''} ${e.isDir ? 'code-tree-dir' : ''}`}
                onClick={() => e.isDir ? loadDir(e.path) : openFile(e.path)}
                title={e.path}
              >
                <span className="mat mat-sm code-tree-icon">
                  {e.isDir ? 'folder' : TEXT_EXTS.has(ext(e.name)) ? 'description' : 'insert_drive_file'}
                </span>
                <span className="code-tree-name">{e.name}</span>
                {e.isDir && <span className="mat mat-sm" style={{ color: 'var(--outline)', marginLeft: 'auto', fontSize: 12 }}>chevron_right</span>}
              </button>
            ))}
            {entries.length === 0 && !loading && (
              <div style={{ color: 'var(--muted)', fontSize: 10, padding: 8 }}>Empty directory</div>
            )}
          </div>
        </div>

        {/* File viewer */}
        <div className="code-viewer">
          {selectedFile ? (
            <>
              <div className="code-viewer-header">
                <span className="mat mat-sm" style={{ color: 'var(--secondary)' }}>description</span>
                <span style={{ fontSize: 10, color: 'var(--text)', fontWeight: 700 }}>
                  {selectedFile.split('/').pop()}
                </span>
                <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 8 }}>
                  {langFromExt(ext(selectedFile.split('/').pop() ?? '')).toUpperCase()} · {lineCount} LINES
                </span>
                {loading && <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 8 }}>Loading…</span>}
                {error && <span style={{ fontSize: 9, color: 'var(--error)', marginLeft: 8 }}>{error}</span>}
              </div>
              <div className="code-content-wrap">
                <div className="code-line-nums">
                  {fileContent.split('\n').map((_, i) => (
                    <div key={i} className="code-line-num">{i + 1}</div>
                  ))}
                </div>
                <pre className="code-content">{fileContent}</pre>
              </div>
            </>
          ) : (
            <div className="panel-empty" style={{ minHeight: 200 }}>
              <span className="mat" style={{ fontSize: 36, color: 'var(--ghost)' }}>description</span>
              <div className="panel-empty-text">SELECT A FILE</div>
              <div className="panel-empty-hint">Click a file in the tree to view its contents</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
