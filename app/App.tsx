import { useEffect } from 'react'
import './App.css'
import TidesView from './views/TidesView'

/* Rev182: WelcomeScreen ELIMINADO. Cuando se entra a /signalk-mareas-ihm/
   (sin path específico) redirigimos directo al visor de fondeo. La ruta
   /mareas sigue mostrando TidesView standalone para acceso directo y
   también para el iframe embebido dentro del visor. */

function App() {
  /* Rev182: ELIMINADO el WelcomeScreen / landing. Cuando se entra a
     /signalk-mareas-ihm/ sin path específico, redirigimos directo al
     visor de fondeo (entrada principal). TidesView se integra dentro
     del visor como modal-iframe (m_openMareas). El path /mareas sigue
     mostrando TidesView standalone para acceso directo / embebido. */
  useEffect(() => {
    if (!window.location.pathname.includes('/mareas')) {
      window.location.replace('/signalk-mareas-ihm/visorfondeo')
      return
    }
    const loadDPR = window.devicePixelRatio || 1
    let baseDPR = loadDPR
    if (window.outerWidth > 0 && window.innerWidth > 0) {
      const initZoom = window.outerWidth / window.innerWidth
      if (initZoom > 1.05 && initZoom < 5) baseDPR = loadDPR / initZoom
    }
    function applyZoomFix() {
      const dpr = window.devicePixelRatio || 1
      const browserZoom = dpr / baseDPR
      const counter = Math.abs(browserZoom - 1) > 0.05 ? 1 / browserZoom : 1
      document.documentElement.style.setProperty('--zoom-fix', String(counter))
    }
    applyZoomFix()
    window.addEventListener('resize', applyZoomFix)
    return () => window.removeEventListener('resize', applyZoomFix)
  }, [])

  /* Sin landing — siempre TidesView (cuando la URL es /mareas, sino
     ya estamos redirigiendo en el useEffect). */
  return <TidesView />
}

export default App
