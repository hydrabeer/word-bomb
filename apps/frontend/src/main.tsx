import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import JoinRoom from './pages/JoinRoom.tsx';
import Room from './pages/Room.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<JoinRoom/>}/>
        <Route path="/room/:roomCode" element={<Room/>}/>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
