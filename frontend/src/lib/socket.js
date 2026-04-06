"use client";

import { io } from "socket.io-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const SOCKET_BASE_URL = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL;

let socketInstance = null;
let socketToken = "";

export const getSocketClient = (token) => {
  if (!token) {
    return null;
  }

  if (!socketInstance || socketToken !== token) {
    if (socketInstance) {
      socketInstance.disconnect();
    }

    socketToken = token;
    socketInstance = io(SOCKET_BASE_URL, {
      autoConnect: false,
      auth: {
        token
      },
      transports: ["websocket", "polling"]
    });
  }

  if (!socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
};

export const closeSocketClient = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    socketToken = "";
  }
};
