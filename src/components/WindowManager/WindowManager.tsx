import { useWindowStore } from '../../store/windowStore'
import { Window } from './Window'
import { TerminalWindow } from '../Terminal/TerminalWindow'
import { WorkflowEditor } from '../Workflow/WorkflowEditor'
import { SettingsPanel } from '../Settings/SettingsPanel'

function WindowContent({ component, props }: { component: string; props: Record<string, unknown> }) {
  switch (component) {
    case 'Terminal':
      return <TerminalWindow sessionId={props.sessionId as string} toolId={props.toolId as string} />
    case 'WorkflowEditor':
      return <WorkflowEditor />
    case 'Settings':
      return <SettingsPanel />
    default:
      return <div className="p-4 text-muted">Unknown component: {component}</div>
  }
}

export function WindowManager() {
  const { windows } = useWindowStore()

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {windows.map((win) => (
        <div key={win.id} className="pointer-events-auto absolute" style={{ left: 0, top: 0, width: '100%', height: '100%' }}>
          <Window
            id={win.id}
            title={win.title}
            position={win.position}
            size={win.size}
            zIndex={win.zIndex}
            minimized={win.minimized}
          >
            <WindowContent component={win.component} props={win.props} />
          </Window>
        </div>
      ))}
    </div>
  )
}
