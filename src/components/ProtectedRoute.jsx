import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function ProtectedRoute({ children }) {
  const { user, loading, initialized } = useAuthStore()

  if (!initialized || loading) {
    return (
      <div className="min-h-screen bg-iron-950 flex flex-col items-center justify-center gap-6">
        <style>{`
          @keyframes heartbeat {
            0%   { transform: scale(1);    opacity: 1; }
            14%  { transform: scale(1.15); opacity: 1; }
            28%  { transform: scale(1);    opacity: 1; }
            42%  { transform: scale(1.1);  opacity: 1; }
            70%  { transform: scale(1);    opacity: 0.75; }
            100% { transform: scale(1);    opacity: 1; }
          }
          .animate-heartbeat {
            animation: heartbeat 1.6s ease-in-out infinite;
          }
        `}</style>
        <img
          src="/utils/SOLUTECH-02.png"
          alt="SolutechQuiniela"
          className="w-24 h-24 object-contain animate-heartbeat"
        />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
