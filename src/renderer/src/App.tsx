import { CreateSessionScreen } from './features/session/CreateSessionScreen'
import { useSessionStore } from './stores/session-store'

export default function App(): React.JSX.Element {
  const form = useSessionStore((state) => state.form)

  return (
    <div className="h-screen bg-transparent p-2">
      <CreateSessionScreen onCreate={() => console.log('Create session:', form)} />
    </div>
  )
}
