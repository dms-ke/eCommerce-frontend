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
  sellerName?: string; // 🔥 Added so Admins can see the vendor
  sellerEmail?: string;
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
  orderDate: string;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  deliveryMethod: string; 
  shippingAddress?: any;
  phoneNumber?: string;
  items: OrderItem[];
  user?: { id: number; fullName: string; email: string; };
  disputeReason?: string; 
};

type EarningsStats = {
  availableBalance: number;
  pendingClearance: number;
  totalWithdrawn: number;
  disputedFunds: number;
};

type Dispute = {
  id: number;
  orderId: number;
  productId: number;
  customerId: number;
  customerName: string;
  productName: string;
  amount: number;
  reason: string;
  photos: string[];
  status: "OPEN" | "RESOLVED" | "ESCALATED";
  createdAt: string;
};

// ==========================================
// 2. MAIN ADMIN DASHBOARD COMPONENT
// ==========================================
export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("products");
 const [disputes, setDisputes] = useState<Dispute[]>([]);
 const [activeDispute, setActiveDispute] = useState<Dispute | null>(null); // 👈 ADD THIS LINE
 const [activeChat, setActiveChat] = useState<any>(null); // 🔥 ADD THIS LINE
  
  // 🔥 AUTH & ROLE STATES
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState("seller");
  
  // Products State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSellerData = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }
      try {
        const decoded: any = jwtDecode(token);
        const role = decoded.role || decoded.roles;
        
        // Check if user is a Super Admin
        const adminCheck = role === 'ADMIN' || role === 'admin' || (Array.isArray(role) && (role.includes('admin') || role.includes('ADMIN')));
        
        setIsAdmin(adminCheck);
        setUserRole(role);

        // Kick out normal users
        if (role !== "SELLER" && role !== "seller" && !adminCheck) {
          router.push("/");
          return;
        }

        const res = await fetch("http://localhost:3000/products/seller", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          
          // 🔥 FIX: Safely check if the response is an array. 
          // If it's wrapped in an object (e.g., data.data or data.products), extract the array.
          const extractedProducts = Array.isArray(data) ? data : (data.data || data.products || []);
          setProducts(extractedProducts);
          
        } else {
          console.error("Failed to fetch products");
        }
      } catch (err) {
        console.error(err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };
    fetchSellerData();
  }, [router]);

  // Fetch Disputes from the real backend
  const fetchDisputes = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("http://localhost:3000/disputes", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setDisputes(data);
      }
    } catch (err) {
      console.error("Failed to fetch disputes:", err);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:3000/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setProducts(products.filter((p) => p.id !== id));
      } else {
        alert("Failed to delete product.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // 3. ORDERS TAB (FULLY INTEGRATED)
  // ==========================================
  const OrdersTab = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    useEffect(() => {
      const fetchOrders = async () => {
        const token = localStorage.getItem("token");
        try {
          const res = await fetch("http://localhost:3000/orders/seller", {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            // Assuming your backend returns { message: string, data: Order[] }
            setOrders(data.data || data); 
          }
        } catch (error) {
          console.error("Failed to fetch orders", error);
        } finally {
          setOrdersLoading(false);
        }
      };
      fetchOrders();
    }, []);

    const updateOrderStatus = async (orderId: number, newStatus: string) => {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(`http://localhost:3000/orders/${orderId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ status: newStatus })
        });
        
        if (res.ok) {
          setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
          if (selectedOrder && selectedOrder.id === orderId) {
            setSelectedOrder({ ...selectedOrder, status: newStatus });
          }
        } else {
          alert("Failed to update status.");
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (ordersLoading) return <div className="p-8 text-center text-gray-500">Loading orders...</div>;
    
    if (orders.length === 0) return (
      <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-xl font-bold text-gray-800 mb-2">No Orders Yet</h3>
        <p className="text-gray-500">When customers purchase items, they will appear here.</p>
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600 font-bold">
                <tr>
                  <th className="p-4">Order ID</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Total</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-900">#{o.id}</td>
                    <td className="p-4 text-gray-500 text-sm">{new Date(o.orderDate).toLocaleDateString()}</td>
                    <td className="p-4 text-gray-900 text-sm">{o.user?.fullName || "Guest"}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold 
                        ${o.status === 'PENDING_PAYMENT' ? 'bg-orange-50 text-orange-600' : 
                          o.status === 'PAID' ? 'bg-blue-50 text-blue-600' :
                          o.status === 'SHIPPED' ? 'bg-indigo-50 text-indigo-600' :
                          o.status === 'DELIVERED' ? 'bg-green-50 text-green-600' :
                          o.status === 'DISPUTED' ? 'bg-red-50 text-red-600' :
                          'bg-gray-100 text-gray-600'}`}>
                        {o.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-gray-900">Ksh {Number(o.totalAmount).toLocaleString()}</td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setSelectedOrder(o)}
                        className="text-blue-600 font-bold text-sm hover:underline"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ORDER DETAILS MODAL */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
              
              <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Order #{selectedOrder.id}</h2>
                  <p className="text-sm text-gray-500">{new Date(selectedOrder.orderDate).toLocaleString()}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-900 transition-colors p-2 rounded-full hover:bg-gray-100">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                
                {/* Status Bar */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Current Status</p>
                    <span className="font-bold text-blue-600">{selectedOrder.status.replace('_', ' ')}</span>
                  </div>
                  {selectedOrder.status === 'PAID' && (
                    <button 
                      onClick={() => updateOrderStatus(selectedOrder.id, 'SHIPPED')}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700"
                    >
                      Mark as Shipped
                    </button>
                  )}
                  {selectedOrder.status === 'SHIPPED' && (
                     <div className="text-sm font-medium text-gray-600">Awaiting Customer Confirmation</div>
                  )}
                </div>

                {/* 🔥 DISPUTE ALERT BOX WITH SCROLL AND WRAP FIX */}
                {selectedOrder.status === 'DISPUTED' && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-xs font-black text-red-800 uppercase tracking-wider">Escrow Frozen</p>
                    </div>
                    
                    <p className="text-[11px] text-red-700 leading-tight mb-3">
                      The customer has reported an issue. Funds for this order cannot be withdrawn by the seller until resolved.
                    </p>

                    {selectedOrder.disputeReason ? (
                      <div className="bg-white p-3 rounded-lg border border-red-100 shadow-inner">
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block mb-1">Customer Reason:</span>
                        <div className="max-h-32 overflow-y-auto pr-1">
                          <p className="text-xs text-gray-800 italic break-words whitespace-normal">
                            "{selectedOrder.disputeReason}"
                          </p>
                        </div>
                      </div>
                    ) : (
                       <div className="bg-white p-3 rounded-lg border border-red-100 shadow-inner">
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block mb-1">Customer Reason:</span>
                        <p className="text-xs text-gray-400 italic">No reason provided.</p>
                      </div>                
                    )}
                  </div>
                )}

                {/* Customer Details */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3 border-b pb-2">Customer Info</h3>
                    <p className="text-sm text-gray-700 mb-1 font-medium">{selectedOrder.shippingAddress?.fullName || selectedOrder.user?.fullName}</p>
                    <p className="text-sm text-gray-600 mb-1">{selectedOrder.user?.email}</p>
                    <p className="text-sm text-gray-600">📞 {selectedOrder.phoneNumber || selectedOrder.shippingAddress?.phoneNumber}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3 border-b pb-2">Delivery Details</h3>
                    <p className="text-sm text-gray-600 mb-1">{selectedOrder.shippingAddress?.streetAddress}</p>
                    <p className="text-sm text-gray-600 mb-1">{selectedOrder.shippingAddress?.city}</p>
                    <p className="text-xs font-bold text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded mt-1">
                      {selectedOrder.deliveryMethod === 'PLATFORM' ? 'Platform Delivery' : 'Vendor Delivery'}
                    </p>
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3 border-b pb-2">Items Ordered</h3>
                  <div className="space-y-3">
                    {selectedOrder.items.map(item => (
                      <div key={item.id} className="flex items-center gap-4 border border-gray-100 p-3 rounded-lg bg-gray-50">
                        <div className="w-12 h-12 bg-white rounded border border-gray-200 overflow-hidden flex-shrink-0">
                          {item.product?.photoUrl ? (
                            <img src={`http://localhost:3000${item.product.photoUrl}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 bg-gray-100">No Img</div>
                          )}
                        </div>
                        <div className="flex-grow">
                          <p className="text-sm font-bold text-gray-900 line-clamp-1">{item.product?.name || "Deleted Product"}</p>
                          <p className="text-xs text-gray-500">Qty: {item.quantity} × Ksh {Number(item.price).toLocaleString()}</p>
                        </div>
                        <div className="font-bold text-gray-900 text-sm">
                          Ksh {(item.quantity * Number(item.price)).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
// ==========================================
// 4. MESSAGES TAB (Inbox View)
// ==========================================

const MessagesTab = ({ activeChat }: { activeChat?: any }) => {
  const [threads, setThreads] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  const socketRef = useRef<any>(null); // adjusted type for safety
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Setup Socket & Fetch Messages (WITH RACE-CONDITION FIX)
  useEffect(() => {
    let isMounted = true; // 🔥 Crucial fix to stop the disappearing chat bug!

    const setupInbox = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const decoded: any = jwtDecode(token);

        const res = await fetch("http://localhost:3000/messages/inbox", {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          const rawItems = Array.isArray(data) ? data : (data.data || []);

          let formattedThreads = [];

          if (rawItems.length > 0 && rawItems[0].messages === undefined) {
            const threadMap = new Map<string, any>();

            rawItems.forEach((msg: any) => {
              const threadId = `${msg.senderId}-${msg.orderId}-${msg.productId}`;
              
              if (!threadMap.has(threadId)) {
                threadMap.set(threadId, {
                  threadId,
                  customerId: msg.senderId,
                  customerName: msg.sender?.fullName || "Customer",
                  orderId: msg.orderId,
                  productId: msg.productId,
                  messages: [],
                  lastMessageAt: msg.createdAt || new Date().toISOString(),
                  orderInfo: msg.order,
                  productInfo: msg.product
                });
              }
              
              const thread = threadMap.get(threadId)!;
              thread.messages.push(msg);
              
              if (new Date(msg.createdAt) > new Date(thread.lastMessageAt)) {
                thread.lastMessageAt = msg.createdAt;
              }
            });

            formattedThreads = Array.from(threadMap.values()).sort(
              (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
            );
          } else {
            formattedThreads = rawItems;
          }

          // 🔥 Only update state if this component hasn't unmounted!
          if (isMounted) {
            setThreads(formattedThreads);
          }
        }

        // 🔥 Only connect sockets if the component is still alive
        if (isMounted) {
          socketRef.current = io("http://localhost:3000");
          socketRef.current.emit("joinSellerInbox", decoded.sub);

          socketRef.current.on("newMessage", (msg: any) => {
            setThreads(prevThreads => {
              const threadId = `${msg.senderId}-${msg.orderId}-${msg.productId}`;
              const existingThreadIndex = prevThreads.findIndex(t => t.threadId === threadId);

              if (existingThreadIndex > -1) {
                const updatedThreads = [...prevThreads];
                updatedThreads[existingThreadIndex].messages.push(msg);
                updatedThreads[existingThreadIndex].lastMessageAt = msg.createdAt;
                return updatedThreads.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
              } else {
                const newThread = {
                  threadId,
                  customerId: msg.senderId,
                  customerName: msg.sender?.fullName || "Customer",
                  orderId: msg.orderId,
                  productId: msg.productId,
                  messages: [msg],
                  lastMessageAt: msg.createdAt,
                  orderInfo: msg.order,
                  productInfo: msg.product
                };
                return [newThread, ...prevThreads];
              }
            });
          });
        }

      } catch (error) {
        console.error("Failed to load inbox", error);
      } finally {
        // 🔥 Safely remove the loading screen
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    setupInbox();

    // 🔥 Cleanup function: React runs this if the component unmounts quickly
    return () => {
      isMounted = false; 
      socketRef.current?.disconnect();
    };
  }, []);

  // 2. Listen for activeChat from the Disputes Tab
  useEffect(() => {
    // Only run this AFTER the background fetch finishes loading
    if (activeChat && !loading) {
      
      const targetThreadId = `${activeChat.id}-${activeChat.orderId}-${activeChat.productId}`;
      
      setThreads(prevThreads => {
        const exists = prevThreads.some(t => t.threadId === targetThreadId);
        
        if (!exists) {
          const newBlankThread = {
            threadId: targetThreadId,
            customerId: activeChat.id,
            customerName: activeChat.name,
            orderId: activeChat.orderId,
            productId: activeChat.productId,
            messages: [], 
            lastMessageAt: new Date().toISOString(),
            orderInfo: { id: activeChat.orderId },
            productInfo: { id: activeChat.productId, name: activeChat.productName }
          };
          return [newBlankThread, ...prevThreads]; 
        }
        return prevThreads;
      });

      // Force the chat window to open this specific thread
      setActiveThreadId(targetThreadId);
    }
  }, [activeChat, loading]);

  // 3. Auto-scroll to bottom of active chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThreadId, threads]);

  // 4. Send Message Logic
  const handleSendReply = async () => {
    if (!replyText.trim() || !activeThreadId) return;

    const activeThread = threads.find(t => t.threadId === activeThreadId);
    if (!activeThread) return;

    setIsSending(true);
    const token = localStorage.getItem("token");

    try {
      const res = await fetch("http://localhost:3000/messages/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: activeThread.customerId,
          orderId: activeThread.orderId,
          productId: activeThread.productId,
          content: replyText
        })
      });

      if (res.ok) {
        const savedMessage = await res.json(); 
        setReplyText("");

        setThreads(prevThreads => {
          const updatedThreads = [...prevThreads];
          const threadIndex = updatedThreads.findIndex(t => t.threadId === activeThreadId);
          
          if (threadIndex > -1) {
            const alreadyExists = updatedThreads[threadIndex].messages.some((m: any) => m.id === savedMessage.id);
            
            if (!alreadyExists) {
              updatedThreads[threadIndex].messages.push(savedMessage);
              updatedThreads[threadIndex].lastMessageAt = savedMessage.createdAt;
            }
          }
          return updatedThreads.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
        });

      } else {
        alert("Failed to send message");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  // ==========================================
  // RENDER UI
  // ==========================================

  if (loading) return <div className="p-8 text-center text-gray-500">Loading inbox...</div>;

  if (threads.length === 0) return (
    <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-xl font-bold text-gray-800 mb-2">No Messages Yet</h3>
      <p className="text-gray-500">Conversations regarding orders will appear here.</p>
    </div>
  );

  const activeThread = threads.find(t => t.threadId === activeThreadId);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex h-[600px] overflow-hidden">
      
      {/* Left Side: Thread List */}
      <div className="w-1/3 border-r border-gray-200 overflow-y-auto bg-gray-50 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
          <h3 className="font-bold text-gray-900">Customer Messages</h3>
        </div>
        <div className="flex-grow divide-y divide-gray-100">
          {threads.map(thread => {
            const hasMessages = thread.messages && thread.messages.length > 0;
            const lastMsg = hasMessages ? thread.messages[thread.messages.length - 1] : null;
            const isUnread = lastMsg ? !lastMsg.isFromSeller : false; 
            
            return (
              <div 
                key={thread.threadId}
                onClick={() => setActiveThreadId(thread.threadId)}
                className={`p-4 cursor-pointer transition-colors relative ${activeThreadId === thread.threadId ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-100 border-l-4 border-transparent'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`font-bold text-sm ${isUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                    {thread.customerName}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {new Date(thread.lastMessageAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-blue-600 font-medium mb-1">Order #{thread.orderId}</p>
                
                {lastMsg ? (
                  <p className={`text-xs line-clamp-1 ${isUnread ? 'font-bold text-gray-800' : 'text-gray-500'}`}>
                    {lastMsg.isFromSeller ? 'You: ' : ''}{lastMsg.content}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 italic">No messages yet.</p>
                )}
              </div>
            );
          })}
        </div>
        </div>

      {/* Right Side: Chat Window */}
      <div className="w-2/3 flex flex-col bg-white">
        {activeThread ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm">
              <div>
                <h3 className="font-bold text-gray-900">{activeThread.customerName}</h3>
                <div className="flex gap-2 text-xs text-gray-500 mt-1">
                  <span>Order #{activeThread.orderId}</span>
                  <span>•</span>
                  <span className="line-clamp-1">{activeThread.productInfo?.name || "Product"}</span>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-grow p-4 overflow-y-auto bg-gray-50 space-y-4">
              {activeThread.messages.map((msg: any) => {
                const isMe = msg.isFromSeller;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl p-3 ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'}`}>
                      <p className="text-sm">{msg.content}</p>
                      <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendReply(); }}
                className="flex gap-2"
              >
                <input 
                  type="text" 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply to customer..."
                  className="flex-grow border border-gray-300 rounded-full px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900 bg-gray-50"
                />
                <button 
                  type="submit"
                  disabled={isSending || !replyText.trim()}
                  className="bg-blue-600 text-white rounded-full px-6 py-2 text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center text-gray-400 flex-col gap-4">
             <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
             <p>Select a conversation to view messages</p>
          </div>
        )}
      </div>
    </div>
  );
};

  // ==========================================
  // 5. CUSTOMERS TAB (View Past Buyers)
  // ==========================================
  const CustomersTab = () => {
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const fetchCustomers = async () => {
        const token = localStorage.getItem("token");
        try {
          const res = await fetch("http://localhost:3000/users/customers/seller", {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setCustomers(data.data || data); // Accommodate backend response structure
          }
        } catch (error) {
          console.error("Failed to fetch customers", error);
        } finally {
          setLoading(false);
        }
      };
      fetchCustomers();
    }, []);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading customers...</div>;

    if (customers.length === 0) return (
      <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-xl font-bold text-gray-800 mb-2">No Customers Yet</h3>
        <p className="text-gray-500">Your customer list will grow as you make sales.</p>
      </div>
    );

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600 font-bold">
            <tr>
              <th className="p-4">Customer Name</th>
              <th className="p-4">Email</th>
              <th className="p-4">Total Orders</th>
              <th className="p-4">Total Spent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map((c, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="p-4 font-bold text-gray-900">{c.fullName}</td>
                <td className="p-4 text-gray-600 text-sm">{c.email}</td>
                <td className="p-4 text-gray-900 font-medium">{c.orderCount}</td>
                <td className="p-4 text-green-600 font-bold">Ksh {Number(c.totalSpent || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Update the first line of the component to receive these props:
// Helper function to safely render Base64 strings, external URLs, or local backend paths
const getImageUrl = (path?: string) => {
  // 1. Handle missing or completely empty paths
  if (!path || path.trim() === "") {
    return 'https://placehold.co/150x150/eeeeee/999999?text=No+Image';
  }

  // 2. Catch corrupted/empty base64 strings from the database (causing your ERR_INVALID_URL)
  if (path === 'data:image/jpeg;base64' || path === 'data:image/png;base64') {
    return 'https://placehold.co/150x150/ffedd5/ea580c?text=Corrupted+Image';
  }

  // 3. If it's already a complete valid URL or valid Base64, use it directly
  if (path.startsWith('http') || path.startsWith('data:image/')) {
    return path;
  }

  // 4. Catch raw base64 strings (like the iVBORw0KGgo... one in your logs)
  if (path.length > 200) {
    // PNGs in base64 almost always start with iVBOR
    if (path.startsWith('iVBOR')) {
      return `data:image/png;base64,${path}`;
    }
    return `data:image/jpeg;base64,${path}`;
  }

  // 5. If none of the above, it must be a backend file upload
  return `http://localhost:3000${path.startsWith('/') ? '' : '/'}${path}`;
};

const DisputesTab = ({
  disputes,
  activeDispute,
  setActiveDispute,
  setActiveTab,
  fetchDisputes,
  setActiveChat // 🔥 ADDED: We need this to route the chat correctly!
}: {
  disputes: Dispute[];
  activeDispute: Dispute | null;
  setActiveDispute: (d: Dispute | null) => void;
  setActiveTab: (tab: string) => void;
  fetchDisputes: () => void;
  setActiveChat: (chat: any) => void; // 🔥 ADDED
}) => {
  
  const handleAcceptRefund = async (disputeId: number) => {
    if (!confirm("Are you sure you want to accept fault and refund this customer?")) return;
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:3000/disputes/${disputeId}/accept`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        alert("Dispute resolved and order refunded!");
        fetchDisputes(); // Refresh the list
        setActiveDispute(null); // Go back to the main disputes list
      } else {
        alert("Failed to resolve dispute.");
      }
    } catch (err) {
      console.error(err);
    }
  };

// Inside your component:
const [chatLogs, setChatLogs] = useState<any[]>([]);
const [isViewingChat, setIsViewingChat] = useState(false);
const [loadingChat, setLoadingChat] = useState(false);

// Decode token to check if user is Admin
const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
let isAdmin = false;
if (token) {
  try {
    const decoded: any = jwtDecode(token);
    isAdmin = decoded?.role === 'ADMIN' || decoded?.role === 'admin' || decoded?.roles?.includes('ADMIN');
  } catch (err) {
    console.error("Invalid token");
  }
}

// 1. Fetch the secret evidence chat logs
  const toggleChatHistory = async (orderId: number, productId: number) => {
    if (isViewingChat) {
      setIsViewingChat(false);
      return;
    }

    setLoadingChat(true);
    setIsViewingChat(true);
    
    try {
      const res = await fetch(`http://localhost:3000/messages/admin/thread/${orderId}/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatLogs(data);
      } else {
        alert("Failed to load chat history.");
        setIsViewingChat(false);
      }
    } catch (err) {
      console.error(err);
      setIsViewingChat(false);
    } finally {
      setLoadingChat(false);
    }
  };

  // 2. Fire the final God-Mode verdict
  const handleAdminAction = async (disputeId: number, action: 'refund' | 'release') => {
    const isRefund = action === 'refund';
    const confirmMsg = isRefund 
      ? "Are you sure you want to FORCE A REFUND? The customer will win this dispute." 
      : "Are you sure you want to RELEASE FUNDS? The seller will win this dispute.";
      
    if (!window.confirm(confirmMsg)) return;

    const endpoint = isRefund ? 'admin-refund' : 'admin-release';

    try {
      const res = await fetch(`http://localhost:3000/disputes/${disputeId}/${endpoint}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        alert(`Verdict applied: ${isRefund ? 'Customer Refunded' : 'Funds Released to Seller'}`);
        // 🔥 Call your function here to refresh the disputes list (e.g., fetchDisputes())
        // fetchDisputes(); 
      } else {
        alert("Failed to apply verdict.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEscalate = async (disputeId: number) => {
    if (!confirm("Are you sure you want to escalate this to an Admin?")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:3000/disputes/${disputeId}/escalate`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        alert("Dispute escalated to Platform Admin.");
        fetchDisputes(); // Refresh the list
        setActiveDispute(null); // Go back to the main disputes list
      } else {
        alert("Failed to escalate dispute.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (activeDispute) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-100 p-6">
        <button 
          onClick={() => setActiveDispute(null)}
          className="text-gray-500 text-sm font-bold mb-4 hover:underline"
        >
          &larr; Back to Disputes
        </button>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black text-gray-800">Dispute #{activeDispute.id}</h2>
            <p className="text-sm text-gray-500">Filed on {new Date(activeDispute.createdAt).toLocaleDateString()}</p>
          </div>
          <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            {activeDispute.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Order Info Card */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="font-black text-gray-900 mb-4 uppercase text-xs tracking-wider">Order Information</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="font-semibold text-gray-500 text-sm">Product:</span> 
                <span className="font-bold text-gray-900 text-sm">{activeDispute.productName}</span>
              </div>
              
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="font-semibold text-gray-500 text-sm">Order ID:</span> 
                <span className="font-bold text-gray-900 text-sm">#{activeDispute.orderId}</span>
              </div>
              
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="font-semibold text-gray-500 text-sm">Amount:</span> 
                <span className="font-bold text-gray-900 text-sm">Ksh {activeDispute.amount.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-500 text-sm">Customer:</span> 
                <span className="font-bold text-blue-600 text-sm hover:underline cursor-pointer">{activeDispute.customerName}</span>
              </div>
            </div>
          </div>

          {/* Customer Claim Card */}
          <div className="bg-orange-50 p-4 rounded border border-orange-100">
            <h3 className="font-bold text-orange-800 mb-3 uppercase text-xs">Customer's Claim</h3>
            <p className="text-sm text-gray-800 italic mb-3">"{activeDispute.reason}"</p>
            
            {/* Evidence Photos - 🔥 UPDATED TO USE getImageUrl */}
            {activeDispute.photos.length > 0 && (
              <div className="flex gap-2 mt-2">
                {activeDispute.photos.map((photo, idx) => (
                  <img 
                    key={idx} 
                    src={getImageUrl(photo)} 
                    alt="Evidence" 
                    className="h-16 w-16 object-cover rounded border border-orange-200 cursor-pointer hover:opacity-80" 
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ============================== */}
        {/* ACTION BUTTONS & ADMIN VERDICT */}
        {/* ============================== */}
        <div className="border-t border-gray-100 pt-6 flex flex-col gap-4">
          
          {/* STANDARD SELLER ACTIONS */}
          {!isAdmin && activeDispute.status === 'OPEN' && (
            <div className="flex flex-wrap gap-4 items-center">
              <button 
                onClick={() => {
                  setActiveChat({
                    id: activeDispute.customerId, 
                    name: activeDispute.customerName,
                    orderId: activeDispute.orderId,
                    productId: activeDispute.productId,
                    productName: activeDispute.productName
                  });
                  setActiveTab("messages");
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded shadow-sm transition-colors"
              >
                Chat with Customer
              </button>

              <button 
                onClick={() => handleAcceptRefund(activeDispute.id)}
                className="bg-white border-2 border-green-500 text-green-600 hover:bg-green-50 font-bold py-2 px-6 rounded transition-colors"
              >
                Accept & Refund
              </button>

              <button 
                onClick={() => handleEscalate(activeDispute.id)}
                className="text-gray-500 hover:text-red-600 font-bold text-sm ml-auto underline"
              >
                Escalate to Admin
              </button>
            </div>
          )}

          {/* ADMIN GOD-MODE PANEL */}
          {isAdmin && activeDispute.status === 'ESCALATED' && (
            <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-gray-800 mt-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-white font-black text-lg">Admin Resolution Panel</h3>
                  <p className="text-gray-400 text-sm">Review evidence before making a final escrow decision.</p>
                </div>
                
                {/* Toggle Chat Evidence Button */}
                <button 
                  onClick={() => toggleChatHistory(activeDispute.orderId, activeDispute.productId)}
                  className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 text-sm font-bold py-2 px-4 rounded transition-colors flex items-center gap-2"
                >
                  {isViewingChat ? 'Hide Chat Logs' : '👁️ View Seller-Customer Chat Logs'}
                </button>
              </div>

              {/* Read-Only Chat Log Viewer */}
              {isViewingChat && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6 h-64 overflow-y-auto border-4 border-gray-700 shadow-inner">
                  {loadingChat ? (
                    <p className="text-center text-gray-500 mt-10 font-medium">Decrypting chat logs...</p>
                  ) : chatLogs.length === 0 ? (
                    <p className="text-center text-gray-500 mt-10 font-medium">No messages were exchanged between the seller and customer.</p>
                  ) : (
                    <div className="space-y-4">
                      {chatLogs.map((msg, idx) => (
                        <div key={idx} className={`flex flex-col ${msg.isFromSeller ? 'items-end' : 'items-start'}`}>
                          <span className={`text-[10px] font-bold mb-1 uppercase ${msg.isFromSeller ? 'text-blue-600' : 'text-orange-600'}`}>
                            {msg.isFromSeller ? 'Seller' : 'Customer'}
                          </span>
                          <div className={`max-w-[80%] rounded-xl p-3 text-sm ${msg.isFromSeller ? 'bg-blue-100 text-blue-900 rounded-tr-none' : 'bg-orange-100 text-orange-900 rounded-tl-none'}`}>
                            {msg.content}
                          </div>
                          <span className="text-[9px] text-gray-400 mt-1">
                            {new Date(msg.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* The Final Verdict Buttons */}
              <div className="flex gap-4 pt-4 border-t border-gray-700">
                <button 
                  onClick={() => handleAdminAction(activeDispute.id, 'refund')}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-3 px-6 rounded shadow-lg transition-colors"
                >
                  CUSTOMER WINS (Force Refund)
                </button>
                <button 
                  onClick={() => handleAdminAction(activeDispute.id, 'release')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-3 px-6 rounded shadow-lg transition-colors"
                >
                  SELLER WINS (Release Funds)
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
        );           {/* 🔥 2. Closes the return( statement */}
  }              {/* 🔥 3. Closes the if (activeDispute) { block */}

  // The List View
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-black text-gray-800 mb-6">Disputes Center</h2>
      
      {disputes.length === 0 ? (
        <p className="text-gray-500">No active disputes. Great job!</p>
      ) : (
        <div className="space-y-3">
          {disputes.map((dispute) => (
            <div 
              key={dispute.id} 
              className="flex items-center justify-between p-4 border border-gray-100 rounded hover:bg-red-50 hover:border-red-100 cursor-pointer transition-colors"
              onClick={() => setActiveDispute(dispute)}
            >
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-bold text-gray-800">Order #{dispute.orderId}</span>
                  <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded font-bold">{dispute.status}</span>
                </div>
                <p className="text-sm text-gray-500">Issue with {dispute.productName} • Ksh {dispute.amount.toLocaleString()}</p>
              </div>
              <button className="text-blue-600 font-bold text-sm">Review &rarr;</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

  // ==========================================
  // 6. EARNINGS & WITHDRAWAL TAB
  // ==========================================
  const EarningsTab = () => {
    const [stats, setStats] = useState<EarningsStats>({
      availableBalance: 0,
      pendingClearance: 0,
      totalWithdrawn: 0,
      disputedFunds: 0
    });
    const [loading, setLoading] = useState(true);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    
    const [phoneNumber, setPhoneNumber] = useState("");
    const [amount, setAmount] = useState("");
    const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    const fetchWallet = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const decoded: any = jwtDecode(token);
        const sellerId = decoded.sub;

        const res = await fetch(`http://localhost:3000/payments/balance/${sellerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          // 🔥 FIX 1: Safely unwrap the object if the backend wraps it in { data: {...} }
          const actualStats = data.data || data; 
          setStats(actualStats);
        }
      } catch (err) {
        console.error("Failed to fetch wallet stats", err);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchWallet();
    }, []);

    const handleWithdraw = async (e: React.FormEvent) => {
      // ... keep your existing handleWithdraw code ...
      e.preventDefault();
      setMessage(null);
      setIsWithdrawing(true);

      const withdrawAmount = Number(amount);
      const available = Number(stats?.availableBalance || 0);

      if (withdrawAmount < 50) {
        setMessage({ type: 'error', text: "Minimum withdrawal is Ksh 50" });
        setIsWithdrawing(false);
        return;
      }
      if (withdrawAmount > available) {
        setMessage({ type: 'error', text: "Insufficient available funds" });
        setIsWithdrawing(false);
        return;
      }

      const token = localStorage.getItem("token");
      try {
        const res = await fetch(`http://localhost:3000/payments/withdraw`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            phoneNumber,
            amount: withdrawAmount
          })
        });

        const data = await res.json();

        if (res.ok) {
          setMessage({ type: 'success', text: `Success! Ksh ${withdrawAmount} sent to ${phoneNumber}.` });
          setAmount("");
          fetchWallet(); 
        } else {
          setMessage({ type: 'error', text: data.message || "Withdrawal failed." });
        }
      } catch (err) {
        setMessage({ type: 'error', text: "A network error occurred." });
      } finally {
        setIsWithdrawing(false);
      }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading your wallet...</div>;

    // 🔥 FIX 2: Added Number() cast and || 0 fallbacks to guarantee a number is passed to toLocaleString()
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl border border-green-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-green-50 rounded-bl-full -mr-8 -mt-8"></div>
            <p className="text-sm font-bold text-gray-500 mb-1">Available to Withdraw</p>
            <h3 className="text-3xl font-black text-green-600">Ksh {Number(stats?.availableBalance || 0).toLocaleString()}</h3>
            <p className="text-xs text-green-700 mt-2 bg-green-50 inline-block px-2 py-1 rounded">Cleared & Ready</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-bold text-gray-500 mb-1">Pending Clearance</p>
            <h3 className="text-2xl font-black text-gray-900">Ksh {Number(stats?.pendingClearance || 0).toLocaleString()}</h3>
            <p className="text-xs text-gray-500 mt-2">Locked in Escrow (Awaiting delivery)</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm relative">
            <p className="text-sm font-bold text-gray-500 mb-1">Disputed Funds</p>
            <h3 className="text-2xl font-black text-red-600">Ksh {Number(stats?.disputedFunds || 0).toLocaleString()}</h3>
            <p className="text-xs text-red-700 mt-2">Frozen due to customer dispute</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm">
            <p className="text-sm font-bold text-gray-500 mb-1">Total Withdrawn</p>
            <h3 className="text-2xl font-black text-blue-600">Ksh {Number(stats?.totalWithdrawn || 0).toLocaleString()}</h3>
            <p className="text-xs text-blue-700 mt-2">All time earnings paid out</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm max-w-2xl">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Withdraw to M-Pesa</h2>
          <p className="text-sm text-gray-500 mb-6">Instantly transfer your cleared earnings to your M-Pesa number. Withdrawals process in under 60 seconds.</p>
          
          {message && (
            <div className={`mb-6 p-4 rounded-lg font-bold text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleWithdraw} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">M-Pesa Phone Number</label>
              <input 
                type="text" 
                placeholder="e.g. 254700000000" 
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block p-3 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Must start with 254.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Amount to Withdraw (Ksh)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <span className="text-gray-500 font-bold">Ksh</span>
                </div>
                <input 
                  type="number" 
                  min="50"
                  max={stats.availableBalance}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block pl-12 p-3 outline-none font-bold"
                  placeholder="0.00"
                />
                <button 
                  type="button" 
                  onClick={() => setAmount(stats.availableBalance.toString())}
                  className="absolute inset-y-2 right-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold px-3 rounded"
                >
                  Max
                </button>
              </div>
            </div>
            <button 
              type="submit"
              disabled={isWithdrawing || stats.availableBalance < 50}
              className="w-full text-white bg-green-600 hover:bg-green-700 font-bold rounded-lg text-sm px-5 py-3.5 text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {isWithdrawing ? "Processing Payout..." : "Withdraw Funds Now"}
            </button>
          </form>
        </div>
      </div>
    );
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500 font-bold">Verifying Access...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex-shrink-0">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-black text-gray-900 tracking-tight">
            {isAdmin ? "Global Admin Hub" : "Seller Hub"}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isAdmin ? "Manage platform operations" : "Manage your store"}
          </p>
        </div>
        <nav className="p-4 space-y-1">
          <button onClick={() => setActiveTab("products")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${activeTab === "products" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>
            Products
          </button>
          <button onClick={() => setActiveTab("orders")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${activeTab === "orders" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>
            Orders
          </button>
          <button onClick={() => setActiveTab("customers")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${activeTab === "customers" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>
            Customers
          </button>
          <button onClick={() => setActiveTab("messages")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${activeTab === "messages" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>
            Customer Inbox
          </button>

      
<button
  onClick={() => setActiveTab("disputes")}
  className={`w-full text-left px-4 py-3 font-bold rounded flex justify-between items-center ${
    activeTab === "disputes" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
  }`}
>
  <span>Disputes</span>
  {/* 🔥 The Red Notification Badge! */}
  {disputes.filter(d => d.status === "OPEN").length > 0 && (
    <span className="bg-red-500 text-white text-[10px] px-2 py-1 rounded-full">
      {disputes.filter(d => d.status === "OPEN").length} New
    </span>
  )}
</button>
          <button onClick={() => setActiveTab("earnings")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${activeTab === "earnings" ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>
            Earnings & Wallet
          </button>

          {/* 🔥 ADMIN-ONLY TAB (Conditionally Rendered) */}
          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-gray-100">
              <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Admin Controls</p>
              <button onClick={() => setActiveTab("platform-settings")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${activeTab === "platform-settings" ? "bg-purple-50 text-purple-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>
                Platform Settings
              </button>
            </div>
          )}
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-grow p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-black text-gray-900 capitalize">
              {activeTab === "earnings" ? "My Wallet" : activeTab.replace('-', ' ')}
            </h1>
            {activeTab === "products" && (
              <button onClick={() => router.push("/admin/add-product")} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-colors shadow-sm">
                + Add Product
              </button>
            )}
          </div>

          <div className="mt-4">
            
            {/* PRODUCTS TAB */}
            {activeTab === "products" && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600 font-bold">
                        <tr>
                          <th className="p-4">Product Name</th>
                          <th className="p-4">Price</th>
                          <th className="p-4">Stock</th>
                          {/* 🔥 ADMIN ONLY: Show Vendor Column */}
                          {isAdmin && <th className="p-4 text-purple-600">Vendor</th>}
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {products.map((p) => (
                          <tr key={p.id} className="border-b border-gray-100 text-sm hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-bold text-gray-900">{p.name}</td>
                            <td className="p-4 font-bold text-gray-800">Ksh {p.price.toLocaleString()}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.stock > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                {p.stock} UNIT
                              </span>
                            </td>
                            {/* 🔥 ADMIN ONLY: Vendor Name or Email */}
                            {isAdmin && (
                              <td className="p-4 text-xs font-medium text-gray-500">
                                {p.sellerName || p.sellerEmail || "System"}
                              </td>
                            )}
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

            {activeTab === "messages" && <MessagesTab activeChat={activeChat} />}
            {activeTab === "orders" && <OrdersTab />}
            {activeTab === "customers" && <CustomersTab />}
            {activeTab === "disputes" && (
  <DisputesTab 
    disputes={disputes}
    activeDispute={activeDispute}
    setActiveDispute={setActiveDispute}
    setActiveTab={setActiveTab}
    fetchDisputes={fetchDisputes}
    setActiveChat={setActiveChat} // 🔥 YOU MUST ADD THIS LINE
  />
)}
            {activeTab === "earnings" && <EarningsTab />}
            
            {/* 🔥 NEW ADMIN-ONLY TAB CONTENT */}
            {activeTab === "platform-settings" && isAdmin && (
              <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-purple-200">
                <h3 className="text-xl font-bold text-purple-900 mb-2">Platform Settings</h3>
                <p className="text-gray-500">Global configurations, commission rules, and user management will go here.</p>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
