import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import BottomNavBar from './BottomNavBar'

export default function Layout() {
  return (
    <div className="min-h-screen bg-iron-50 dark:bg-iron-950 text-iron-900 dark:text-iron-100 transition-colors duration-200">
      <Navbar />
      <main className="p-4 lg:p-6 min-h-[calc(100vh-4rem)] pb-24 overflow-x-hidden">
        <Outlet />
      </main>
      <BottomNavBar />
    </div>
  )
}
