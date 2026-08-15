import { useState } from 'react'
import { CreateSessionScreen } from './features/session/CreateSessionScreen'
import { OverlayHUD } from './features/overlay/OverlayHUD'
import { seedDemoOverlayData } from './features/overlay/seed-demo-data'

export default function App(): React.JSX.Element {
  const [screen, setScreen] = useState<'session' | 'overlay'>('session')

  return (
    <div className="h-screen bg-transparent p-2">
      {screen === 'session' ? (
        <CreateSessionScreen
          onCreate={() => {
            seedDemoOverlayData()
            setScreen('overlay')
          }}
        />
      ) : (
        <OverlayHUD />
      )}
    </div>
  )
}
