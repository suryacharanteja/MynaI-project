import { useState } from 'react'
import { Toaster } from 'sonner'
import { CreateSessionScreen } from './features/session/CreateSessionScreen'
import { OverlayHUD } from './features/overlay/OverlayHUD'

export default function App(): React.JSX.Element {
  const [screen, setScreen] = useState<'session' | 'overlay'>('session')

  return (
    <div className="h-screen bg-transparent p-2">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#e5e5e5',
            border: '1px solid rgba(255,255,255,0.1)'
          }
        }}
      />
      {screen === 'session' ? (
        <CreateSessionScreen onCreate={() => setScreen('overlay')} />
      ) : (
        <OverlayHUD />
      )}
    </div>
  )
}
