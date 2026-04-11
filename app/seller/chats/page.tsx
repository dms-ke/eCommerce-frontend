"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

// 🔥 UPDATED: Added order and product types
type InboxMessage = {
  id: number;
  content: string;
  senderId: number;
  sellerName: string;
  orderId: number;
  productId: number;
  isFromSeller: boolean;
  createdAt: string;
  sender?: {
    id: number;
    fullName: string;
  };
  order?: {
    id: number;
    totalAmount: number;
    status: string;
    phoneNumber: string;
    shippingAddress: any; // Contains fullName, streetAddress, city
  };
  product?: {
    id: number;
    name: string;
    photoUrl: string;
    price: number;
  };
};

type ChatThread = {
  threadId: string; 
  customerId: number;
  customerName: string;
  orderId: number;
  productId: number;
  messages: InboxMessage[];
  lastMessageAt: string;
  orderInfo?: InboxMessage['order'];     // 🔥 Attached Order Data
  productInfo?: InboxMessage['product']; // 🔥 Attached Product Data
};

const getImageUrl = (path?: string) => {
  if (!path) return 'https://placehold.co/150x150/eeeeee/999999?text=No+Image';
  if (path.startsWith('http')) return path; 
  return `http://localhost:3000${path.startsWith('/') ? '' : '/'}${path}`;
};

export default function SellerChatsPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const MY_SELLER_NAME = "Official Tech Store"; 

  const fetchInbox = async () => {
    const token = localStorage.getItem("token");
    if (!token) return router.push("/login");

    try {
      const res = await fetch(`http://localhost:3000/messages/inbox/${MY_SELLER_NAME}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data: InboxMessage[] = await res.json();
        
        const groupedThreads: Record<string, ChatThread> = {};
        
        data.forEach(msg => {
          const threadId = `${msg.senderId}-${msg.orderId}-${msg.productId}`;
          if (!groupedThreads[threadId]) {
            groupedThreads[threadId] = {
              threadId,
              customerId: msg.senderId,
              customerName: msg.sender?.fullName || `Customer #${msg.senderId}`,
              orderId: msg.orderId,
              productId: msg.productId,
              messages: [],
              lastMessageAt: msg.createdAt,
              orderInfo: msg.order,     // Store the order details
              productInfo: msg.product  // Store the product details
            };
          }
          groupedThreads[threadId].messages.push(msg);
          groupedThreads[threadId].lastMessageAt = msg.createdAt;
        });

        const threadsArray = Object.values(groupedThreads).sort((a, b) => 
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        );
        
        setThreads(threadsArray);
      }
    } catch (err) {
      console.error("Failed to load inbox", err);
    }
  };

  useEffect(() => {
    fetchInbox();
    const interval = setInterval(fetchInbox, 5000);
    return () => clearInterval(interval);
  }, []);

  const activeThread = threads.find(t => t.threadId === activeThreadId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread?.messages]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !activeThread) return;

    const token = localStorage.getItem("token");
    const contentToSend = replyContent;
    setReplyContent(""); 

    try {
      const res = await fetch("http://localhost:3000/messages/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          customerId: activeThread.customerId,
          sellerName: MY_SELLER_NAME,
          content: contentToSend,
          orderId: activeThread.orderId,
          productId: activeThread.productId
        })
      });

      if (res.ok) fetchInbox(); 
    } catch (error) {
      console.error("Failed to send reply", error);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-6 flex justify-center">
      {/* 🔥 Expanded to max-w-7xl to fit the 3 columns nicely */}
      <div className="w-full max-w-7xl bg-white rounded-2xl shadow-sm border border-gray-200 flex overflow-hidden h-[88vh]">
        
        {/* COLUMN 1: Inbox List (1/4 width) */}
        <div className="w-1/4 border-r border-gray-200 flex flex-col bg-white min-w-[280px]">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900">Inbox</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <p className="p-6 text-center text-gray-500 text-sm">No active chats.</p>
            ) : (
              threads.map(thread => {
                const lastMsg = thread.messages[thread.messages.length - 1];
                const isUnread = !lastMsg.isFromSeller; 
                return (
                  <button 
                    key={thread.threadId}
                    onClick={() => setActiveThreadId(thread.threadId)}
                    className={`w-full text-left p-4 border-b border-gray-100 hover:bg-blue-50 transition-colors ${activeThreadId === thread.threadId ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`text-sm truncate pr-2 ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                        {thread.customerName}
                      </h4>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {new Date(thread.lastMessageAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-blue-600 mb-1 line-clamp-1">{thread.productInfo?.name || `Product #${thread.productId}`}</p>
                    <p className={`text-xs line-clamp-2 ${isUnread ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                      {lastMsg.isFromSeller ? `You: ${lastMsg.content}` : lastMsg.content}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* COLUMN 2: Chat Window (2/4 width) */}
        <div className="flex-1 flex flex-col bg-gray-50 relative border-r border-gray-200">
          {activeThread ? (
            <>
              <div className="p-4 bg-white border-b border-gray-200 shadow-sm z-10 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{activeThread.customerName}</h3>
                  <p className="text-sm text-gray-500">Order #{activeThread.orderId}</p>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
                {activeThread.messages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-2xl max-w-[75%] shadow-sm ${
                      msg.isFromSeller 
                        ? "bg-blue-600 text-white self-end rounded-br-none"
                        : "bg-white border border-gray-200 text-gray-900 self-start rounded-tl-none"
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-[10px] text-right mt-1 ${msg.isFromSeller ? "text-blue-200" : "text-gray-400"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* 🔥 FIXED BLURRY INPUT: Added clear text-gray-900, bg-gray-100, and standard borders */}
              <form onSubmit={handleReply} className="p-4 bg-white border-t border-gray-200 flex gap-3 items-center">
                <input 
                  type="text"
                  value={replyContent}
                  onChange={e => setReplyContent(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1 border border-gray-300 bg-gray-100 text-gray-900 placeholder-gray-500 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors font-medium"
                  autoFocus
                />
                <button 
                  type="submit"
                  disabled={!replyContent.trim()}
                  className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
              <p className="text-lg font-medium text-gray-500">Select a conversation to reply</p>
            </div>
          )}
        </div>

        {/* COLUMN 3: Context Details (1/4 width) - 🔥 NEW SECTION */}
        <div className="w-1/4 bg-white flex flex-col min-w-[280px] overflow-y-auto">
          {activeThread ? (
            <div className="p-6 space-y-6">
              
              {/* Product Info */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Product in Question</h3>
                {activeThread.productInfo ? (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col items-center text-center gap-2">
                    <img 
                      src={getImageUrl(activeThread.productInfo.photoUrl)} 
                      alt="Product" 
                      className="w-24 h-24 object-contain rounded-lg bg-white p-2 border border-gray-200"
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-900 leading-tight">{activeThread.productInfo.name}</p>
                      <p className="text-xs font-semibold text-blue-600 mt-1">Ksh {Number(activeThread.productInfo.price).toLocaleString()}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Product ID: {activeThread.productId}</p>
                )}
              </div>

              {/* Order Status */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Order Status</h3>
                {activeThread.orderInfo ? (
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <p className="text-xs text-gray-500 mb-1">Order Number</p>
                    <p className="font-bold text-gray-900 mb-3">#{activeThread.orderInfo.id}</p>
                    
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <span className="inline-block px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-800 uppercase shadow-sm">
                      {activeThread.orderInfo.status}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Order Data Loading...</p>
                )}
              </div>

              {/* Customer Shipping Details */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Customer Details</h3>
                {activeThread.orderInfo?.shippingAddress ? (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2 text-sm text-gray-700">
                    <p className="font-bold text-gray-900">
                      {activeThread.orderInfo.shippingAddress.fullName || activeThread.customerName}
                    </p>
                    <p className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                      <span className="leading-snug">
                        {activeThread.orderInfo.shippingAddress.streetAddress}<br/>
                        {activeThread.orderInfo.shippingAddress.city}
                      </span>
                    </p>
                    <p className="flex items-center gap-2 pt-2 border-t border-gray-200 mt-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                      {activeThread.orderInfo.phoneNumber || 'N/A'}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No delivery address provided.</p>
                )}
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center bg-gray-50">
               <p className="text-sm font-medium">Context panel</p>
               <p className="text-xs mt-1">Select a chat to view order and product details here.</p>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}