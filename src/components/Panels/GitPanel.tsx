import { useEffect, useRef, useState } from 'react'
import {
  isTauri,
  gitStatus, gitLog, gitDiff,
  gitStage, gitUnstage, gitCommit,
  gitPush, gitPull, gitDiscard,
  type GitStatus, type GitLogEntry, type GitStatusEntry,
} from '../../lib/tauri'
import { toast } from '../../store/toastStore'

const DEFAULT_CWD = '/home/kael/nexus-ai'

type Tab = 'changes' | 'log' | 'diff'

const KIND_ICON: Record<string, string> = {
  modified:  'edit',
  added:     'add_circle',
  deleted:   'remove_circle',
  untracked: 'help_outline',
  renamed:   'drive_file_rename_outline',
}

const KIND_COLOR: Record<string, string> = {
  modified:  'var(--secondary)',
  added:     'var(--primary)',
  deleted:   'var(--error)',
  untracked: 'var(--muted)',
  renamed:   'var(--tertiary)',
}

export function GitPanel() {
  const [cwd] = useState(DEFAULT_CWD)
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [log, setLog] = useState<GitLogEntry[]>([])
  const [diff, setDiff] = useState('')
  const [diffPath, setDiffPath] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('changes')
  const [commitMsg, setCommitMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const commitRef = useRef<HTMLTextAreaElement>(null)

  const refresh = async () => {
    if (!isTauri()) return
    setLoading(true)
    try {
      const [s, l] = await Promise.all([gitStatus(cwd), gitLog(cwd)])
      setStatus(s)
      setLog(l.entries)
    } catch (e) {
      toast.error('Git error', String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [cwd])

  const showDiff = async (path?: string) => {
    try {
      const d = await gitDiff(cwd, path)
      setDiff(d || '// No diff')
      setDiffPath(path ?? null)
      setTab('diff')
    } catch (e) {
      toast.error('Diff error', String(e))
    }
  }

  const doStage = async (path: string) => {
    try { await gitStage(cwd, path); refresh() }
    catch (e) { toast.error('Stage failed', String(e)) }
  }

  const doUnstage = async (path: string) => {
    try { await gitUnstage(cwd, path); refresh() }
    catch (e) { toast.error('Unstage failed', String(e)) }
  }

  const doDiscard = async (path: string) => {
    try { await gitDiscard(cwd, path); refresh() }
    catch (e) { toast.error('Discard failed', String(e)) }
  }

  const doCommit = async () => {
    if (!commitMsg.trim()) { toast.warning('Commit message required'); return }
    setBusy(true)
    try {
      await gitCommit(cwd, commitMsg.trim())
      setCommitMsg('')
      toast.success('Committed')
      refresh()
    } catch (e) { toast.error('Commit failed', String(e)) }
    finally { setBusy(false) }
  }

  const doPush = async () => {
    setBusy(true)
    try { await gitPush(cwd); toast.success('Pushed'); refresh() }
    catch (e) { toast.error('Push failed', String(e)) }
    finally { setBusy(false) }
  }

  const doPull = async () => {
    setBusy(true)
    try { await gitPull(cwd); toast.success('Pulled'); refresh() }
    catch (e) { toast.error('Pull failed', String(e)) }
    finally { setBusy(false) }
  }

  const staged   = status?.entries.filter((e) => e.staged) ?? []
  const unstaged = status?.entries.filter((e) => !e.staged) ?? []

  const FileRow = ({ entry, showActions }: { entry: GitStatusEntry; showActions: 'stage' | 'unstage' }) => (
    <div className="git-file-row" onClick={() => showDiff(entry.path)}>
      <span className="mat mat-sm git-file-icon" style={{ color: KIND_COLOR[entry.kind] }}>
        {KIND_ICON[entry.kind] ?? 'description'}
      </span>
      <span className="git-file-path">{entry.path}</span>
      <span className="git-file-kind">{entry.xy}</span>
      <div className="git-file-actions">
        {showActions === 'stage' && entry.kind !== 'untracked' && (
          <button className="git-action-btn" onClick={(ev) => { ev.stopPropagation(); showDiff(entry.path) }} title="View diff">
            <span className="mat mat-sm">unfold_more</span>
          </button>
        )}
        {showActions === 'stage' && (
          <button className="git-action-btn git-action-add" onClick={(ev) => { ev.stopPropagation(); doStage(entry.path) }} title="Stage">
            <span className="mat mat-sm">add</span>
          </button>
        )}
        {showActions === 'stage' && entry.kind !== 'untracked' && (
          <button className="git-action-btn git-action-discard" onClick={(ev) => { ev.stopPropagation(); doDiscard(entry.path) }} title="Discard changes">
            <span className="mat mat-sm">undo</span>
          </button>
        )}
        {showActions === 'unstage' && (
          <button className="git-action-btn" onClick={(ev) => { ev.stopPropagation(); doUnstage(entry.path) }} title="Unstage">
            <span className="mat mat-sm">remove</span>
          </button>
        )}
      </div>
    </div>
  )

  if (!isTauri()) {
    return (
      <div className="section-panel">
        <div className="section-header"><span className="section-title">// SOURCE_CONTROL</span></div>
        <div className="panel-empty">
          <span className="mat" style={{ fontSize: 40, color: 'var(--ghost)' }}>account_tree</span>
          <div className="panel-empty-text">TAURI REQUIRED</div>
          <div className="panel-empty-hint">Git integration only available in the desktop app</div>
        </div>
      </div>
    )
  }

  return (
    <div className="section-panel">
      {/* Header */}
      <div className="section-header">
        <span className="section-title">// SOURCE_CONTROL</span>
        {status?.is_repo && (
          <>
            <span className="git-branch-badge">
              <span className="mat mat-sm">call_split</span>
              {status.branch}
            </span>
            {status.upstream && (
              <span className="section-meta" style={{ color: 'var(--muted)' }}>
                {status.upstream}
                {status.ahead > 0 && <span style={{ color: 'var(--primary)', marginLeft: 6 }}>↑{status.ahead}</span>}
                {status.behind > 0 && <span style={{ color: 'var(--tertiary)', marginLeft: 6 }}>↓{status.behind}</span>}
              </span>
            )}
          </>
        )}
        <div style={{ flex: 1 }} />
        <button className="section-header-btn" onClick={doPull} disabled={busy || !status?.is_repo} title="git pull">
          <span className="mat mat-sm">download</span>PULL
        </button>
        <button className="section-header-btn" onClick={doPush} disabled={busy || !status?.is_repo} title="git push">
          <span className="mat mat-sm">upload</span>PUSH
        </button>
        <button className="section-header-btn" onClick={refresh} disabled={loading} title="Refresh">
          <span className="mat mat-sm">{loading ? 'sync' : 'refresh'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="git-tabs">
        {(['changes', 'log', 'diff'] as Tab[]).map((t) => (
          <button key={t} className={`git-tab ${tab === t ? 'git-tab-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'changes' && `CHANGES (${(status?.entries.length ?? 0)})`}
            {t === 'log'     && `LOG (${log.length})`}
            {t === 'diff'    && `DIFF${diffPath ? ` — ${diffPath.split('/').pop()}` : ''}`}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="git-body">

        {/* CHANGES TAB */}
        {tab === 'changes' && (
          <>
            {!status?.is_repo ? (
              <div className="panel-empty">
                <span className="mat" style={{ fontSize: 40, color: 'var(--ghost)' }}>account_tree</span>
                <div className="panel-empty-text">NOT A GIT REPO</div>
                <div className="panel-empty-hint">{cwd}</div>
              </div>
            ) : (
              <>
                {/* Commit box */}
                <div className="git-commit-box">
                  <textarea
                    ref={commitRef}
                    className="git-commit-input"
                    placeholder="Commit message…"
                    value={commitMsg}
                    onChange={(e) => setCommitMsg(e.target.value)}
                    rows={2}
                    onKeyDown={(e) => { if (e.ctrlKey && e.key === 'Enter') doCommit() }}
                  />
                  <button
                    className="git-commit-btn"
                    onClick={doCommit}
                    disabled={busy || staged.length === 0 || !commitMsg.trim()}
                    title="Commit staged (Ctrl+Enter)"
                  >
                    <span className="mat mat-sm">check</span>
                    COMMIT {staged.length > 0 ? `(${staged.length})` : ''}
                  </button>
                </div>

                {/* Staged */}
                {staged.length > 0 && (
                  <div className="git-section">
                    <div className="git-section-header">
                      <span>STAGED ({staged.length})</span>
                      <button className="git-action-btn" onClick={() => Promise.all(staged.map((e) => gitUnstage(cwd, e.path))).then(refresh)} title="Unstage all">
                        <span className="mat mat-sm">remove_done</span>
                      </button>
                    </div>
                    {staged.map((e) => <FileRow key={e.path} entry={e} showActions="unstage" />)}
                  </div>
                )}

                {/* Unstaged */}
                {unstaged.length > 0 && (
                  <div className="git-section">
                    <div className="git-section-header">
                      <span>CHANGES ({unstaged.length})</span>
                      <button className="git-action-btn git-action-add" onClick={() => Promise.all(unstaged.map((e) => gitStage(cwd, e.path))).then(refresh)} title="Stage all">
                        <span className="mat mat-sm">add_task</span>
                      </button>
                    </div>
                    {unstaged.map((e) => <FileRow key={e.path} entry={e} showActions="stage" />)}
                  </div>
                )}

                {status.entries.length === 0 && (
                  <div className="panel-empty" style={{ minHeight: 120 }}>
                    <span className="mat" style={{ fontSize: 32, color: 'var(--primary)' }}>check_circle</span>
                    <div className="panel-empty-text">WORKING TREE CLEAN</div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* LOG TAB */}
        {tab === 'log' && (
          <div className="git-log-list">
            {log.length === 0 && (
              <div className="panel-empty" style={{ minHeight: 120 }}>
                <div className="panel-empty-text">NO COMMITS</div>
              </div>
            )}
            {log.map((entry) => (
              <div key={entry.hash} className="git-log-row">
                <span className="git-log-hash">{entry.short_hash}</span>
                <span className="git-log-msg">{entry.message}</span>
                <span className="git-log-author">{entry.author}</span>
                <span className="git-log-date">{entry.date}</span>
              </div>
            ))}
          </div>
        )}

        {/* DIFF TAB */}
        {tab === 'diff' && (
          <div className="git-diff-view">
            {diff ? (
              diff.split('\n').map((line, i) => {
                const cls = line.startsWith('+') && !line.startsWith('+++')
                  ? 'diff-add'
                  : line.startsWith('-') && !line.startsWith('---')
                  ? 'diff-del'
                  : line.startsWith('@@')
                  ? 'diff-hunk'
                  : 'diff-ctx'
                return <div key={i} className={`diff-line ${cls}`}>{line || ' '}</div>
              })
            ) : (
              <div className="panel-empty" style={{ minHeight: 120 }}>
                <div className="panel-empty-text">SELECT A FILE</div>
                <div className="panel-empty-hint">Click a file in CHANGES to view its diff</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
