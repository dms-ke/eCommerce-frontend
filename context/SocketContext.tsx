import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// Define the shape of our context state
interface SocketContextType {
  socket: Socket | null;
  unreadCount: number;
  resetUnread: () => void;
  typingStatus: Record<string, boolean>; // Key: threadId, Value: isTyping
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  unreadCount: 0,
  resetUnread: () => {},
  typingStatus: {},
});

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // 1. Initialize Connection
    socketRef.current = io("http://localhost:3000");

    // 2. Global Listener: Unread Messages
    socketRef.current.on("newChatMessage", (msg) => {
      // Only increment if the message is from a customer
      if (!msg.isFromSeller) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    // 3. Global Listener: Typing Indicators
    // Expects payload: { threadId: string, isTyping: boolean }
    socketRef.current.on("displayTyping", ({ threadId, isTyping }) => {
      setTypingStatus((prev) => ({
        ...prev,
        [threadId]: isTyping,
      }));
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const resetUnread = () => setUnreadCount(0);

  return (
    <SocketContext.Provider 
      value={{ 
        socket: socketRef.current, 
        unreadCount, 
        resetUnread, 
        typingStatus 
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);