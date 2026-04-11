"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { io, Socket } from "socket.io-client";

// ==========================================
// 1. TYPES & HELPERS
// ==========================================
interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  condition: string;
  photoUrl: string;
}

type InboxMessage = {
  id: number;
  content: string;
  senderId: number;
  sellerId: number; 
  sellerName: string;
  orderId: number;
  productId: number;
  isFromSeller: boolean;
  createdAt: string;
  sender?: { id: number; fullName: string; };
  order?: { id: number; totalAmount: number; status: string; phoneNumber: string; shippingAddress: any; };
  product?: { id: number; name: string; photoUrl: string; price: number; };
};

type ChatThread = {
  threadId: string; 
  customerId: number;
  customerName: string;
  orderId: number;
  productId: number;
  messages: InboxMessage[];
  lastMessageAt: string;
  orderInfo?: InboxMessage['order'];     
  productInfo?: InboxMessage['product']; 
};

type OrderItem = {
  id: number;
  productId: number;
  quantity: number;
  price: number;
  product?: Product;
};

type Order = {
  id: number;
  userId: number;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  phoneNumber: string;
  shippingAddress: {
    fullName: string;
    streetAddress: string;
    city: string;
  };
  createdAt: string;
  items: OrderItem[];
  user?: {
    id: number;
    fullName: string;
    email: string;
  };
};

type Customer = {
  id: number;
  email: string;
  role: string;
  createdAt: string;
};

const getImageUrl = (path?: string) => {
  if (!path) return 'https://placehold.co/150x150/eeeeee/999999?text=No+Image';
  if (path.startsWith('http')) return path; 
  return `http://localhost:3000${path.startsWith('/') ? '' : '/'}${path}`;
};


// ==========================================
// 2. ORDER DETAILS COMPONENT
// ==========================================
const ChatOrderDetails = ({ activeThread, isMobileVisible, onCloseMobile }: { activeThread?: ChatThread, isMobileVisible: boolean, onCloseMobile: () => void }) => {
  if (!activeThread || !activeThread.orderInfo || !activeThread.productInfo) {
    return (
      <div className="hidden xl:flex w-[280px] shrink-0 bg-gray-50 border-l border-gray-200 p-6 items-center justify-center text-gray-500 text-sm italic">
        Select a conversation to view details.
      </div>
    );
  }

  const { orderInfo: order, productInfo: product, customerName } = activeThread;

  return (
    <div className={`${isMobileVisible ? 'fixed inset-0 z-50 flex' : 'hidden xl:flex'} w-full xl:w-[280px] shrink-0 bg-white xl:border-l border-gray-200 flex-col overflow-y-auto`}>
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">Order Context</h2>
        <button onClick={onCloseMobile} className="xl:hidden w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full text-gray-700 font-bold hover:bg-gray-300">
          ✕
        </button>
      </div>
      
      <div className="p-5 space-y-6">
        <div>
          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Product</h4>
          <div className="flex gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
            <img src={getImageUrl(product.photoUrl)} alt={product.name} className="w-16 h-16 rounded-xl object-cover border border-gray-100 bg-gray-50" />
            <div className="flex flex-col justify-center">
              <p className="text-sm font-bold text-gray-900 leading-tight line-clamp-2">{product.name}</p>
              <p className="text-xs text-blue-700 font-bold mt-1">Ksh {Number(product.price).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Customer & Delivery</h4>
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-2 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Name:</span>
              <span className="font-bold text-gray-900 text-right">{order.shippingAddress?.fullName || customerName}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Phone:</span>
              <span className="font-bold text-gray-900 text-right">{order.phoneNumber || 'N/A'}</span>
            </div>
            <div className="pt-2 mt-2 border-t border-blue-100">
              <span className="text-gray-600 block mb-1">Address:</span>
              {order.shippingAddress ? (
                <span className="font-bold text-gray-900 block leading-tight">{order.shippingAddress.streetAddress}, <br/> {order.shippingAddress.city}</span>
              ) : (
                <span className="text-gray-500 italic block">No address provided</span>
              )}
            </div>
          </div>
        </div>

        <div>
           <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Order Summary</h4>
           <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2 text-xs shadow-sm">
             <div className="flex justify-between items-center">
                <span className="text-gray-600">Order ID:</span>
                <span className="font-bold text-gray-900">#{order.id}</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-gray-600">Status:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${order.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {order.status}
                </span>
             </div>
             <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-200">
                <span className="text-gray-700 font-bold">Total:</span>
                <span className="font-black text-green-600 text-sm">Ksh {Number(order.totalAmount).toLocaleString()}</span>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. ORDERS TAB COMPONENT
// ==========================================
function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    const token = localStorage.getItem("token");
    try {
      // 🔥 FIX: Added /all to hit the Admin endpoint instead of the Customer endpoint
      const res = await fetch("http://localhost:3000/orders/all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const ordersArray = Array.isArray(data) ? data : (data.data || []);
        setOrders(ordersArray.sort((a: Order, b: Order) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    } catch (err) {
      console.error("Failed to fetch orders", err);
    } finally {
      setIsLoading(false);
    }
  };
  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    const token = localStorage.getItem("token");
    try {
      // Optimistic update
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus as any } : null);
      }

      const res = await fetch(`http://localhost:3000/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error("Status update failed");
    } catch (err) {
      console.error(err);
      fetchOrders(); // Revert on failure
      alert("Failed to update order status.");
    }
  };

  const filteredOrders = statusFilter === "ALL" 
    ? orders 
    : orders.filter(o => o.status === statusFilter);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'PAID': return 'bg-blue-50 text-blue-600';
      case 'SHIPPED': return 'bg-purple-50 text-purple-600';
      case 'DELIVERED': return 'bg-green-50 text-green-600';
      case 'CANCELLED': return 'bg-red-50 text-red-600';
      default: return 'bg-yellow-50 text-yellow-600'; // PENDING
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      
      {/* LEFT: Orders Table */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex gap-2">
            {['ALL', 'PENDING', 'PAID', 'SHIPPED', 'DELIVERED'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                  statusFilter === status 
                    ? 'bg-black text-white' 
                    : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <button onClick={fetchOrders} className="text-gray-400 hover:text-black">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white sticky top-0 z-10 shadow-sm">
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="p-4">Order ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Date</th>
                <th className="p-4 text-right">Total</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {isLoading ? (
                <tr><td colSpan={5} className="p-10 text-center text-gray-400 italic font-bold text-xs uppercase">Loading Orders...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-gray-400 italic font-bold text-xs uppercase">No orders found</td></tr>
              ) : (
                filteredOrders.map(order => (
                  <tr 
                    key={order.id} 
                    onClick={() => setSelectedOrder(order)}
                    className={`cursor-pointer transition-colors ${selectedOrder?.id === order.id ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}
                  >
                    <td className="p-4 font-black text-gray-900">#{order.id}</td>
                    <td className="p-4 font-bold text-gray-700">{order.shippingAddress?.fullName || order.user?.fullName || 'Guest'}</td>
                    <td className="p-4 text-gray-500 font-medium whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-4 text-right font-black text-green-600 whitespace-nowrap">Ksh {Number(order.totalAmount).toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT: Order Details Panel */}
      {selectedOrder ? (
        <div className="w-[320px] shrink-0 border-l border-gray-100 bg-gray-50/50 flex flex-col overflow-y-auto">
          <div className="p-5 border-b border-gray-100 bg-white flex justify-between items-center sticky top-0">
            <div>
              <h3 className="font-black text-gray-900 uppercase tracking-tight">Order #{selectedOrder.id}</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Details & Action</p>
            </div>
            <button onClick={() => setSelectedOrder(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 font-bold">✕</button>
          </div>

          <div className="p-5 space-y-6">
            {/* Status Update */}
            {/* Status Update */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Update Status</p>
              <select 
                value={selectedOrder.status}
                onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                // 🔥 FIX: Added 'text-gray-900' and 'cursor-pointer' to make it visible and clickable
                className="w-full bg-white border border-gray-200 text-gray-900 cursor-pointer rounded-xl px-4 py-3 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-black"
              >
                <option value="PENDING">Pending (Awaiting Payment)</option>
                <option value="PAID">Paid (Processing)</option>
                <option value="SHIPPED">Shipped (In Transit)</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Customer Details */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Delivery Information</p>
              <div className="space-y-2 text-xs">
                <p><span className="text-gray-500 mr-2">Name:</span> <span className="font-bold text-gray-900">{selectedOrder.shippingAddress?.fullName || 'N/A'}</span></p>
                <p><span className="text-gray-500 mr-2">Phone:</span> <span className="font-bold text-gray-900">{selectedOrder.phoneNumber || 'N/A'}</span></p>
                <div className="pt-2 mt-2 border-t border-gray-50">
                  <span className="text-gray-500 block mb-1">Address:</span>
                  <span className="font-bold text-gray-900 leading-relaxed block">
                    {selectedOrder.shippingAddress?.streetAddress || 'No Address Provided'}<br/>
                    {selectedOrder.shippingAddress?.city}
                  </span>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Purchased Items</p>
              <div className="space-y-3">
                {selectedOrder.items?.map(item => (
                  <div key={item.id} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                       {item.product?.photoUrl ? (
                         <img src={getImageUrl(item.product.photoUrl)} className="w-full h-full object-cover" alt="" />
                       ) : (
                         <span className="text-xs text-gray-400 font-bold">IMG</span>
                       )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="text-xs font-bold text-gray-900 truncate">{item.product?.name || `Product ID: ${item.productId}`}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase">QTY: {item.quantity}</span>
                        <span className="text-xs font-black text-blue-600">Ksh {(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-[320px] shrink-0 border-l border-gray-100 bg-gray-50/50 flex items-center justify-center p-10 text-center">
          <div>
             <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
             </div>
             <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Select an order<br/>to view details</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. MESSAGES TAB COMPONENT
// ==========================================
function MessagesTab() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [adminId, setAdminId] = useState<number | null>(null); 
  const [adminDisplayName, setAdminDisplayName] = useState<string>(""); 
  const [showMobileDetails, setShowMobileDetails] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    let idFromToken: number;
    let nameFromToken: string = "Admin";

    try {
      const decoded: any = jwtDecode(token);
      idFromToken = decoded.sub || decoded.userId || decoded.id;
      nameFromToken = decoded.fullName || decoded.name || decoded.email || "Admin";

      if (!idFromToken) return;
      
      setAdminId(Number(idFromToken));
      setAdminDisplayName(nameFromToken);
    } catch (err) {
      console.error("Invalid token format");
      return;
    }

    fetchInbox(token);

    socketRef.current = io("http://localhost:3000");
    socketRef.current.emit("joinSellerInbox", { sellerId: Number(idFromToken) });

    socketRef.current.on("newChatMessage", (message: InboxMessage) => {
      setThreads((prev) => {
        const threadId = `${message.senderId}-${message.orderId}-${message.productId}`;
        const threadIndex = prev.findIndex(t => t.threadId === threadId);
        
        if (threadIndex !== -1) {
          const messageExists = prev[threadIndex].messages.some(m => m.id === message.id);
          if (messageExists) return prev;

          const updatedThreads = [...prev];
          updatedThreads[threadIndex] = {
            ...updatedThreads[threadIndex],
            messages: [...updatedThreads[threadIndex].messages, message],
            lastMessageAt: message.createdAt
          };
          return updatedThreads.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
        } else {
          fetchInbox(token);
          return prev;
        }
      });
    });

    return () => { socketRef.current?.disconnect(); };
  }, []);

  const fetchInbox = async (token: string) => {
    try {
      const res = await fetch(`http://localhost:3000/messages/inbox`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data: InboxMessage[] = await res.json();
        const groupedThreads: Record<string, ChatThread> = {};
        
        data.forEach(msg => {
          const threadId = `${msg.senderId}-${msg.orderId}-${msg.productId}`;
          if (!groupedThreads[threadId]) {
            groupedThreads[threadId] = {
              threadId, customerId: msg.senderId, customerName: msg.sender?.fullName || `Customer #${msg.senderId}`,
              orderId: msg.orderId, productId: msg.productId, messages: [], lastMessageAt: msg.createdAt,
              orderInfo: msg.order, productInfo: msg.product
            };
          }
          groupedThreads[threadId].messages.unshift(msg);
        });

        const threadsArray = Object.values(groupedThreads).sort((a, b) => 
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        );
        setThreads(threadsArray);
      }
    } catch (err) { console.error("Fetch failed", err); }
  };

  const activeThread = threads.find(t => t.threadId === activeThreadId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread?.messages]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!replyContent.trim() || !activeThread || !token || !adminId) return;

    const contentToSend = replyContent;
    setReplyContent(""); 

    try {
      await fetch("http://localhost:3000/messages/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          customerId: activeThread.customerId, sellerName: adminDisplayName,
          content: contentToSend, orderId: activeThread.orderId, productId: activeThread.productId
        })
      });
    } catch (error) { console.error("Reply failed", error); }
  };

  return (
    <div className="w-full h-full bg-white rounded-2xl shadow-sm border border-gray-200 flex overflow-hidden relative">
      
      {/* INBOX LIST */}
      <div className={`w-full md:w-[260px] shrink-0 md:border-r border-gray-200 flex-col bg-white ${activeThreadId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">Inbox</h2>
          <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{threads.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm italic">No conversations found.</div>
          ) : (
            threads.map(thread => {
              const lastMsg = thread.messages[thread.messages.length - 1];
              const isUnread = lastMsg ? !lastMsg.isFromSeller : false; 
              return (
                <button 
                  key={thread.threadId}
                  onClick={() => setActiveThreadId(thread.threadId)}
                  className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors relative ${activeThreadId === thread.threadId ? 'bg-blue-50/50' : ''}`}
                >
                  {isUnread && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-blue-600 rounded-r-full" />}
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <h4 className={`text-sm truncate ${isUnread ? 'font-bold text-gray-900' : 'text-gray-800 font-medium'}`}>{thread.customerName}</h4>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap">{new Date(thread.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {/* 🔥 FIX: Changed fallback from "Product Loading..." to "Archived Product" */}
                  <p className="text-[10px] font-bold text-blue-700 mb-1 line-clamp-1 uppercase tracking-tight">
                    {thread.productInfo?.name || "Archived Product"}
                  </p>
                  <p className={`text-xs line-clamp-1 ${isUnread ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>{lastMsg?.isFromSeller ? `You: ${lastMsg.content}` : lastMsg?.content}</p>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* CHAT AREA */}
      <div className={`flex-1 flex flex-col bg-gray-50 min-w-0 ${!activeThreadId ? 'hidden md:flex' : 'flex'}`}>
        {activeThread ? (
          <>
            <div className="p-3 md:p-4 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                 <button onClick={() => setActiveThreadId(null)} className="md:hidden text-gray-500 hover:text-gray-900 p-2 -ml-2">
                   ←
                 </button>
                 <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm uppercase shrink-0">
                    {activeThread.customerName.charAt(0)}
                 </div>
                 <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 leading-tight truncate">{activeThread.customerName}</h3>
                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest truncate">Order #{activeThread.orderId}</p>
                 </div>
              </div>
              <button 
                onClick={() => setShowMobileDetails(true)} 
                className="xl:hidden shrink-0 text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-bold text-gray-700 transition-colors ml-2"
              >
                Info
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50">
              {activeThread.messages.map((msg, i) => (
                <div key={msg.id || i} className={`flex ${msg.isFromSeller ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] md:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${msg.isFromSeller ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none'}`}>
                    <p className="leading-relaxed">{msg.content}</p>
                    <p className={`text-[9px] mt-1.5 font-bold uppercase tracking-wider ${msg.isFromSeller ? 'text-blue-100' : 'text-gray-500'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleReply} className="p-3 md:p-4 bg-white border-t border-gray-200">
              <div className="flex gap-2 md:gap-3 bg-white p-2 rounded-2xl border border-gray-300 focus-within:border-blue-500 transition-all shadow-sm">
                <input
                  type="text"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 py-2 outline-none text-gray-900"
                />
                <button type="submit" className="bg-blue-600 text-white px-4 md:px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors shrink-0">
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm font-medium">
             Select a conversation to start messaging.
          </div>
        )}
      </div>

      <ChatOrderDetails activeThread={activeThread} isMobileVisible={showMobileDetails} onCloseMobile={() => setShowMobileDetails(false)} />
    </div>
  );
}

// --------------------------------------------------------
// CUSTOMERS TAB COMPONENT (Search, Pagination, CSV Export)
// --------------------------------------------------------
const CustomersTab = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // New State for Features
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // Change this to 10 if you want more rows per page

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await fetch("http://localhost:3000/users/customers/seller", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const json = await res.json();
          setCustomers(json.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch customers:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  // 1. SEARCH LOGIC
  const filteredCustomers = customers.filter(c => 
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 2. PAGINATION LOGIC
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);

  // Reset to page 1 if the user types in the search bar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // 3. CSV EXPORT LOGIC
  const exportToCSV = () => {
    const headers = ["Customer ID", "Email", "Role", "Joined Date"];
    const rows = filteredCustomers.map(c => [
      c.id,
      c.email,
      c.role,
      new Date(c.created_at || c.createdAt).toLocaleDateString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "my_customers.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading customers...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      
      {/* Top Controls: Search & Export */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <input 
  type="text" 
  placeholder="Search by email..." 
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  // 🔥 FIX: Added text-gray-900, bg-white, and placeholder-gray-400
  className="border border-gray-300 bg-white text-gray-900 placeholder-gray-400 rounded-lg px-4 py-2 text-sm w-full sm:w-72 focus:ring-2 focus:ring-blue-500 outline-none"
/>
        <button 
          onClick={exportToCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors w-full sm:w-auto"
        >
          Download CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-grow">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-4 font-semibold">Customer ID</th>
              <th className="p-4 font-semibold">Email</th>
              <th className="p-4 font-semibold">Role</th>
              <th className="p-4 font-semibold">Joined Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentItems.length > 0 ? (
              currentItems.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-medium text-gray-900">#{c.id}</td>
                  <td className="p-4 text-blue-600">{c.email}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold uppercase">
                      {c.role}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500">
                    {new Date(c.created_at || c.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  No customers found matching "{searchQuery}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Controls: Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
          <p className="text-xs text-gray-500">
            Showing <span className="font-bold">{indexOfFirstItem + 1}</span> to <span className="font-bold">{Math.min(indexOfLastItem, filteredCustomers.length)}</span> of <span className="font-bold">{filteredCustomers.length}</span>
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              // 🔥 FIX: Added text-gray-700 here
              className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded text-sm disabled:opacity-50 hover:bg-gray-100"
            >
              Previous
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              // 🔥 FIX: Added text-gray-700 here
              className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded text-sm disabled:opacity-50 hover:bg-gray-100"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// NEW: EARNINGS & WITHDRAWALS COMPONENT
// ==========================================
function EarningsTab() {
  const [balance, setBalance] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | null, text: string }>({ type: null, text: "" });

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    try {
      // 🔥 FIX 1: We must extract the seller ID from the token to pass to the backend
      const decoded: any = jwtDecode(token);
      const sellerId = decoded.sub || decoded.userId || decoded.id;

      if (!sellerId) return;

      // 🔥 FIX 2: Updated to match your EXACT backend balance route
      const res = await fetch(`http://localhost:3000/payments/balance/${sellerId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        // 🔥 FIX 3: Your backend returns 'availableBalance', not 'balance'
        setBalance(data.availableBalance || 0);
      }
    } catch (error) {
      console.error("Failed to fetch balance", error);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const amountNum = parseFloat(withdrawAmount);

    if (!token || isNaN(amountNum) || amountNum <= 0) {
      setStatusMsg({ type: 'error', text: "Please enter a valid amount." });
      return;
    }
    if (amountNum > balance) {
      setStatusMsg({ type: 'error', text: "Insufficient funds." });
      return;
    }

    setIsWithdrawing(true);
    setStatusMsg({ type: null, text: "" });

    try {
      // 🔥 FIX 4: Updated to match your exact backend withdrawal route
      const res = await fetch("http://localhost:3000/payments/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ amount: amountNum, phoneNumber }) 
      });

      const data = await res.json();

      if (res.ok) {
        setStatusMsg({ type: 'success', text: "Withdrawal initiated successfully! Check your M-Pesa." });
        // Deduct the withdrawn amount immediately from the UI
        setBalance(prev => prev - amountNum);
        setWithdrawAmount("");
      } else {
        setStatusMsg({ type: 'error', text: data.message || "Withdrawal failed." });
      }
    } catch (error) {
      setStatusMsg({ type: 'error', text: "Network error occurred." });
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-8 animate-fade-in h-full overflow-y-auto">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Earnings & Withdrawals</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your store revenue and request payouts directly to your M-Pesa.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
        {/* Balance Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Available Balance</p>
          <h2 className="text-4xl font-black text-gray-900">Ksh {balance.toLocaleString()}</h2>
        </div>

        {/* Withdrawal Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Request Payout</h3>
          
          {statusMsg.text && (
            <div className={`p-3 rounded-xl mb-4 text-sm font-bold ${statusMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {statusMsg.text}
            </div>
          )}

          <form onSubmit={handleWithdraw} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Withdrawal Amount (Ksh)</label>
              <input 
                type="number" 
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">M-Pesa Number</label>
              <input 
                type="text" 
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="2547XXXXXXXX"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isWithdrawing || balance <= 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors mt-4"
            >
              {isWithdrawing ? "Processing..." : "Withdraw to M-Pesa"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


// ==========================================
// 4. MAIN DASHBOARD PAGE
// ==========================================
export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ totalProducts: 0, totalRevenue: 0, activeOrders: 0, newCustomers: 0 });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return router.push("/login");

    try {
      const decoded: any = jwtDecode(token);
      if (decoded.role !== "admin") return router.push("/"); 
      setIsAuthorized(true);
      fetchDashboardData(token);
    } catch (error) {
      localStorage.removeItem("token");
      router.push("/login");
    }
  }, [router]);

  const fetchDashboardData = async (token: string) => {
    setIsLoading(true);
    try {
      const prodRes = await fetch("http://localhost:3000/products?limit=50");
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.data || []);
        setStats(prev => ({ ...prev, totalProducts: prodData.total || 0 }));
      }
      const statsRes = await fetch("http://localhost:3000/admin/stats", { headers: { Authorization: `Bearer ${token}` }});
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(prev => ({ ...prev, totalRevenue: statsData.revenue || 0, activeOrders: statsData.activeOrders || 0, newCustomers: statsData.newCustomers || 0 }));
      }
    } catch (err: any) { 
      console.warn("Some endpoints might not be ready."); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await fetch(`http://localhost:3000/products/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }});
      if (!res.ok) throw new Error("Failed to delete product");
      setProducts(products.filter((p) => p.id !== id));
      setStats(prev => ({ ...prev, totalProducts: prev.totalProducts - 1 }));
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center bg-white"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <span className="text-xl font-black text-blue-600 tracking-tight">STORE<span className="text-gray-900">ADMIN</span></span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: "dashboard", label: "Dashboard", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
            { id: "products", label: "Products", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
            { id: "orders", label: "Orders", icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" },
            { id: "customers", label: "Customers", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
            { id: "messages", label: "Messages", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
            { id: "earnings", label: "Earnings", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }
          ].map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex items-center gap-3 px-4 py-3 w-full text-left rounded-xl text-sm font-bold transition-all ${activeTab === item.id ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-gray-500 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon}></path></svg>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button onClick={() => { localStorage.removeItem("token"); router.push("/login"); }} className="flex items-center gap-3 px-4 py-3 w-full text-red-500 hover:bg-red-50 rounded-xl text-sm font-bold transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
          <h1 className="text-lg font-black text-gray-800 uppercase tracking-tight">{activeTab}</h1>
          <div className="flex items-center gap-3">
             <div className="text-right hidden sm:block">
               <p className="text-xs font-bold text-gray-900">Admin User</p>
               <p className="text-[10px] text-green-600 font-bold uppercase">Online</p>
             </div>
             <div className="w-10 h-10 bg-blue-600 rounded-full border-4 border-blue-50 flex items-center justify-center text-white font-black text-sm">A</div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden bg-gray-50">
          <div className="h-full p-6">
            
            {activeTab === "dashboard" && (
              <div className="h-full overflow-y-auto pr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Revenue", value: `Ksh ${stats.totalRevenue.toLocaleString()}`, color: "text-blue-600" },
                    { label: "Active Orders", value: stats.activeOrders, color: "text-gray-900" },
                    { label: "Products", value: stats.totalProducts, color: "text-gray-900" },
                    { label: "New Customers", value: stats.newCustomers, color: "text-gray-900" }
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-wider mb-2">{stat.label}</h3>
                      <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-sm font-black text-gray-900 uppercase">Recent Products</h2>
                    <button onClick={() => setActiveTab("products")} className="text-xs font-bold text-blue-600">View All</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          <th className="p-4">Name</th>
                          <th className="p-4">Price</th>
                          <th className="p-4">Stock</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {products.slice(0, 5).map((p) => (
                          <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-bold text-gray-900">{p.name}</td>
                            <td className="p-4 text-gray-800 font-bold">Ksh {p.price.toLocaleString()}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${p.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {p.stock} In Stock
                              </span>
                            </td>
                            <td className="p-4 text-right">
                               <button onClick={() => router.push(`/admin/edit-product/${p.id}`)} className="text-blue-600 font-bold hover:underline">Edit</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "products" && (
              <div className="h-full bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden shadow-sm">
                 <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="font-black text-gray-900 uppercase text-sm">Product Inventory</h2>
                    <button onClick={() => router.push('/admin/add-product')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700">Add Product</button>
                 </div>
                 <div className="flex-1 overflow-y-auto">
                   <table className="w-full text-left">
                      <thead className="sticky top-0 bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest z-10">
                        <tr><th className="p-4">Product</th><th className="p-4">Price</th><th className="p-4">Stock</th><th className="p-4 text-right">Control</th></tr>
                      </thead>
                      <tbody>
                        {products.map((p) => (
                          <tr key={p.id} className="border-b border-gray-100 text-sm hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-bold text-gray-900">{p.name}</td>
                            <td className="p-4 font-bold text-gray-800">Ksh {p.price.toLocaleString()}</td>
                            <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.stock > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{p.stock} UNIT</span></td>
                            <td className="p-4 text-right space-x-3">
                               <button onClick={() => router.push(`/admin/edit-product/${p.id}`)} className="text-blue-600 font-bold hover:underline">Edit</button>
                               <button onClick={() => handleDelete(p.id)} className="text-red-500 font-bold hover:underline">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                 </div>
              </div>
            )}

            {activeTab === "messages" && <MessagesTab />}

            {/* Fully Integrated Orders Tab */}
            {activeTab === "orders" && <OrdersTab />}

            {activeTab === "customers" && <CustomersTab />}

            {activeTab === "earnings" && <EarningsTab />}  {/* 🔥 ADD THIS LINE */}

          </div>
        </div>
      </main>
    </div>
  );
}