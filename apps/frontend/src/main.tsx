import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.tsx';
import RoomRoute from './pages/RoomRoute.tsx';
import NotFoundPage from './pages/NotFoundPage.tsx';
import DisconnectedPage from './pages/DisconnectedPage.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* Any single segment is tentatively a room; RoomRoute validates pattern */}
        <Route path=":roomCode" element={<RoomRoute />} />
        <Route path="/disconnected" element={<DisconnectedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
