import { useOverlayStore } from '../../stores/overlay-store'

/** Temporary: seeds the overlay with sample data so the HUD is visually verifiable before real IPC (Task #5) is wired. */
export function seedDemoOverlayData(): void {
  const store = useOverlayStore.getState()

  store.addTranscriptMessage({
    id: 'm1',
    source: 'system',
    text: 'Can you write a Python function to check if a string is a palindrome?',
    isFinal: true,
    timestamp: Date.now()
  })
  store.setQuestionDetected(true)
  store.setMicLevel(0.6)

  store.addCard({
    id: 'c1',
    question: 'Write a Python function to check if a string is a palindrome',
    answer:
      'A palindrome reads the same forwards and backwards. I check this by comparing the string to its reverse.',
    keySteps: ['Normalize the string (lowercase, strip non-alphanumeric)', 'Reverse it', 'Compare to the original'],
    code: {
      language: 'python',
      content: 'def is_palindrome(s: str) -> bool:\n    cleaned = \'\'.join(c.lower() for c in s if c.isalnum())\n    return cleaned == cleaned[::-1]'
    },
    explanation: 'This is a common task I perform when validating structured identifiers in data pipelines.',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    status: 'done',
    createdAt: Date.now()
  })
}
