import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.BACKEND_URL || "http://localhost:3001";
export const socket = io(BACKEND_URL);
