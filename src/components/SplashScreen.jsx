import { useEffect, useState } from 'react'

/**
 * Splash screen que se muestra durante `duration` ms y luego llama `onDone`.
 * Hace un fade-out suave en el último medio segundo.
 */
export default function SplashScreen({ onDone, duration = 3000 }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    // Arrancar fade-out 500ms antes de que termine
    const fadeTimer = setTimeout(() => setFading(true), duration - 500)
    const doneTimer = setTimeout(() => onDone?.(), duration)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-iron-950"
      style={{
        transition: 'opacity 0.5s ease',
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <style>{`
        @keyframes heartbeat {
          0%   { transform: scale(1);    filter: drop-shadow(0 0 0px rgba(220,38,38,0)); }
          14%  { transform: scale(1.18); filter: drop-shadow(0 0 18px rgba(220,38,38,0.7)); }
          28%  { transform: scale(1);    filter: drop-shadow(0 0 4px rgba(220,38,38,0.2)); }
          42%  { transform: scale(1.1);  filter: drop-shadow(0 0 12px rgba(59,130,246,0.5)); }
          70%  { transform: scale(1);    filter: drop-shadow(0 0 0px rgba(220,38,38,0)); }
          100% { transform: scale(1);    filter: drop-shadow(0 0 0px rgba(220,38,38,0)); }
        }
        .splash-icon {
          animation: heartbeat 1.6s ease-in-out infinite;
        }
      `}</style>

      <img
        src="/utils/LOGO IRONFBET-04.png"
        alt="IronPlay"
        className="w-36 h-36 object-contain splash-icon"
      />
    </div>
  )
}
