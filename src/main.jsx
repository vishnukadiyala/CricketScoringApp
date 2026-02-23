import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TournamentProvider } from './context/TournamentContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TournamentProvider>
          <App />
        </TournamentProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
