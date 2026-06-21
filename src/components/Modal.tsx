import type { MouseEvent, ReactNode } from 'react'

export default function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const stop = (e: MouseEvent) => e.stopPropagation()

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl md:m-4 md:h-auto md:max-h-[90vh] md:rounded-lg"
        onClick={stop}
      >
        {children}
      </div>
    </div>
  )
}
