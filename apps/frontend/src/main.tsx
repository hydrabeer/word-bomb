import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.tsx';
import RoomPage from './pages/RoomPage.tsx';
import DisconnectedPage from "./pages/DisconnectedPage.tsx";
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage/>}/>
        <Route path="/:roomCode" element={<RoomPage/>}/>
        <Route path="/disconnected" element={<DisconnectedPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
