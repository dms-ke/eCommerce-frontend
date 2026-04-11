"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { io, Socket } from "socket.io-client";

type OrderItem = {
  id: number;
  quantity: number;
  price: number;
  product: { 
    id: number; 
    name: string;
    photoUrl?: string; 
    description?: string; 
    sellerName?: string;
    sellerId?: number; // 🔥 ADDED: For backend ID routing
  };
};

type Order = {
  id: number;
  totalAmount: number;
  shippingFee: number;
  status: string;
  orderDate: string;
  phoneNumber: string;
  paymentMethod: string;
  shippingAddress: {
    fullName: string;
    streetAddress: string;
    city: string;
  } | null;
  items: OrderItem[];
};

type ChatMessage = {
  id: number;
  content: string;
  senderId: number;
  sellerId: number; // 🔥 ADDED
  sellerName: string;
  isFromSeller: boolean; 
  createdAt: string;
};

const getImageUrl = (path?: string) => {
  if (!path) return 'https://placehold.co/150x150/eeeeee/999999?text=No+Image';
  if (path.startsWith('http')) return path; 
  
  const baseUrl = 'http://localhost:3000';
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
};

const OrderCountdown = ({ orderDate, onExpire }: { orderDate: string, onExpire: () => void }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTime = () => {
      const orderTime = new Date(orderDate).getTime();
      const expireTime = orderTime + 60 * 60 * 1000; 
      const now = new Date().getTime();
      const diff = expireTime - now;

      if (diff <= 0) return "00:00";

      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    setTimeLeft(calculateTime());
    
    const timer = setInterval(() => {
      const remaining = calculateTime();
      setTimeLeft(remaining);
      if (remaining === "00:00") {
        clearInterval(timer);
        onExpire(); 
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [orderDate, onExpire]);

  if (!timeLeft) return null;

  return (
    <span className="font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 shadow-sm ml-1">
      {timeLeft}
    </span>
  );
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  // 🔥 UPDATED: Added `id` to the chatSeller state to track the Seller ID
  const [chatSeller, setChatSeller] = useState<{ name: string, id: number, orderId: number, productId: number, productName: string } | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]); 
  const chatEndRef = useRef<HTMLDivElement>(null); 
  
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io("http://localhost:3000");
    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch("http://localhost:3000/orders", {
          headers: { 
            "Authorization": `Bearer ${token}`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache"
          }
        });

        if (!res.ok) throw new Error("Failed to fetch your orders.");

        const data = await res.json();
        setOrders(data.orders || data); 
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [router]);

  const isCancellable = (order: Order) => {
    if (order.status === 'PENDING') return true;
    if (order.status === 'PAID') {
      const orderTime = new Date(order.orderDate).getTime();
      const now = new Date().getTime();
      const diffInMinutes = (now - orderTime) / (1000 * 60);
      return diffInMinutes <= 60;
    }
    return false;
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:3000/orders/${orderId}/cancel`, {
        method: "PATCH", 
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (res.ok) {
        setOrders(prevOrders => prevOrders.map(order => 
          order.id === orderId ? { ...order, status: "CANCELLED" } : order
        ));
      } else {
        const data = await res.json();
        alert(data.message || "Failed to cancel order.");
      }
    } catch (err) {
      console.error("Error cancelling order:", err);
      alert("An error occurred while trying to cancel the order.");
    }
  };

 useEffect(() => {
    if (chatSeller && socket) {
      const fetchHistory = async () => {
        const token = localStorage.getItem("token");
        try {
          // 🔥 FIX: Changed chatSeller.name to chatSeller.id in the URL
          const res = await fetch(`http://localhost:3000/messages/${chatSeller.id}/${chatSeller.orderId}/${chatSeller.productId}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setChatHistory(data);
          }
        } catch (err) {
          console.error("Failed to load chat history:", err);
        }
      };
      
      fetchHistory(); 

      socket.emit("joinOrderChat", { orderId: chatSeller.orderId });

      socket.on("newChatMessage", (message: ChatMessage) => {
        setChatHistory(prev => {
          if (prev.find(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      });

      return () => {
        socket.off("newChatMessage");
      };

    } else {
      setChatHistory([]); 
    }
  }, [chatSeller, socket]); 

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const formatPrice = (amount: number) => {
    return Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !chatSeller) return;
    
    const token = localStorage.getItem("token");
    const messageContent = chatMessage;
    
    setChatMessage("");
    
    try {
      const res = await fetch("http://localhost:3000/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          sellerId: chatSeller.id,     // 🔥 UPDATED: Send the ID to the backend
          sellerName: chatSeller.name, // Keep sending the name for UI purposes
          content: messageContent,
          orderId: chatSeller.orderId,
          productId: chatSeller.productId 
        })
      });

      if (res.ok) {
        const savedMessage = await res.json();
        setChatHistory(prev => {
          if (prev.find(m => m.id === savedMessage.id)) return prev;
          return [...prev, savedMessage];
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  if (loading) return <main className="min-h-screen p-10 flex justify-center"><div className="animate-pulse flex items-center gap-2"><div className="w-5 h-5 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div><p>Loading your orders...</p></div></main>;
  if (error) return <main className="min-h-screen p-10 flex justify-center"><p className="text-red-500 font-medium">{error}</p></main>;

  return (
    <main className="min-h-screen p-6 md:p-10 bg-gray-50 relative">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Order History</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition">
            Continue Shopping &rarr;
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl">🛍️</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No orders yet</h3>
            <p className="text-gray-500 mb-6">Looks like you haven't placed any orders. Let's change that!</p>
            <Link href="/" className="bg-blue-600 text-white px-8 py-3 rounded-full hover:bg-blue-700 transition font-medium shadow-sm">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {orders.map(order => {
              const itemsSubtotal = order.items.reduce((sum, item) => sum + (item.quantity * Number(item.price)), 0);
              const shipping = Number(order.shippingFee || 0);

              return (
                <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <p className="text-sm text-gray-500 font-medium mb-1">Order Placed</p>
                      <p className="text-gray-900 font-semibold">{new Date(order.orderDate).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium mb-1">Order Number</p>
                      <p className="text-gray-900 font-semibold">#{order.id}</p>
                    </div>
                    <div className="sm:text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                        order.status === 'PAID' ? 'bg-green-100 text-green-800' : 
                        order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
                        order.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    <div className="lg:col-span-2 space-y-5">
                      <h4 className="font-bold text-lg text-purple-900 border-b border-gray-100 pb-2">Items</h4>
                      <div className="space-y-6">
                        {order.items?.map(item => {
                          const sellerLabel = item.product?.sellerName || 'Official Store';
                          return (
                            <div key={item.id} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                              
                              <Link 
                                href={`/products/${item.product?.id}`}
                                className="w-24 h-24 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center hover:opacity-80 transition cursor-pointer"
                              >
                                <img 
                                  src={getImageUrl(item.product?.photoUrl)} 
                                  alt={item.product?.name || 'Product'} 
                                  className="object-contain w-full h-full p-2"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://placehold.co/150x150/eeeeee/999999?text=Image+Error';
                                  }}
                                />
                              </Link>
                              
                              <div className="flex-1">
                                <Link 
                                  href={`/products/${item.product?.id}`}
                                  className="font-semibold text-gray-900 text-lg hover:text-blue-600 hover:underline cursor-pointer transition line-clamp-1"
                                >
                                  {item.product?.name || 'Unknown Product'}
                                </Link>
                                
                                {item.product?.description && (
                                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                    {item.product.description}
                                  </p>
                                )}
                                
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                  <p className="text-xs text-gray-500">
                                    Seller: <span className="font-semibold text-gray-900">{sellerLabel}</span>
                                  </p>
                                  
                                  <button 
                                    // 🔥 UPDATED: Capture both the display name AND the numeric ID
                                    onClick={() => setChatSeller({ 
                                      name: sellerLabel, 
                                      id: item.product?.sellerId || 4, // Falls back to 4 if your API hasn't updated the product response yet
                                      orderId: order.id, 
                                      productId: item.product?.id,
                                      productName: item.product?.name || 'Item'
                                    })}
                                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 hover:text-blue-700 transition-colors border border-blue-100"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                                    Chat with Seller
                                  </button>
                                </div>
                                <p className="text-sm text-gray-500 mt-2">Qty: {item.quantity}</p>
                              </div>
                              
                              <div className="text-right sm:ml-auto">
                                <p className="font-bold text-gray-900 text-lg">Ksh {formatPrice(item.quantity * Number(item.price))}</p>
                                {item.quantity > 1 && (
                                  <p className="text-xs text-gray-400 mt-1">Ksh {formatPrice(Number(item.price))} each</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-6 bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-lg text-blue-900 border-b border-blue-200 pb-2 mb-4">Order Summary</h4>
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>Ksh {formatPrice(itemsSubtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Shipping Fee</span>
                            <span>{shipping > 0 ? `Ksh ${formatPrice(shipping)}` : 'Free'}</span>
                          </div>
                          <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between items-center">
                            <span className="font-bold text-gray-900 text-base">Grand Total</span>
                            <span className="font-bold text-xl text-green-600">Ksh {formatPrice(order.totalAmount)}</span>
                          </div>
                        </div>

                        <h4 className="font-bold text-lg text-blue-900 border-b border-blue-200 pb-2 mb-4 mt-6">Delivery Details</h4>
                        {order.shippingAddress ? (
                          <div className="text-sm text-gray-600 space-y-1">
                            <p className="font-semibold text-gray-900">{order.shippingAddress.fullName}</p>
                            <p>{order.shippingAddress.streetAddress}</p>
                            <p>{order.shippingAddress.city}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No delivery address provided.</p>
                        )}
                        
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm font-medium text-gray-900 mb-2">Payment Method</p>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            
                            {order.status !== 'PAID' ? (
                              <span className="flex items-center gap-1 font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded text-xs tracking-wider uppercase">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                PENDING PAYMENT
                              </span>
                            ) : (order.paymentMethod?.toUpperCase() === 'M-PESA' || order.paymentMethod?.toUpperCase() === 'MPESA') ? (
                              <span className="flex items-center gap-1 font-semibold bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] px-2 py-0.5 rounded text-xs tracking-wider uppercase">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                M-PESA
                              </span>
                            ) : order.paymentMethod?.toUpperCase() === 'CARD' ? (
                              <span className="flex items-center gap-1 font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs tracking-wider uppercase">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                                CARD
                              </span>
                            ) : (
                              <span className="font-semibold bg-gray-200 px-2 py-0.5 rounded text-gray-800 text-xs tracking-wider uppercase">
                                {order.paymentMethod || 'UNKNOWN'}
                              </span>
                            )}

                            {order.status === 'PAID' && (order.paymentMethod?.toUpperCase() === 'MPESA' || order.paymentMethod?.toUpperCase() === 'M-PESA') && order.phoneNumber && (
                              <span className="text-gray-500 text-xs font-medium">&bull; {order.phoneNumber}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isCancellable(order) && (
                        <div className="mt-6 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            className="w-full bg-white border border-red-200 text-red-600 font-medium py-2.5 rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors shadow-sm text-sm"
                          >
                            Cancel Order
                          </button>
                          
                          {order.status === 'PAID' && (
                            <p className="text-xs text-gray-500 text-center mt-2 flex items-center justify-center">
                              <svg className="w-3.5 h-3.5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                              Window closes in: 
                              <OrderCountdown 
                                orderDate={order.orderDate} 
                                onExpire={() => setOrders(prev => [...prev])} 
                              />
                            </p>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {chatSeller && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col transform transition-all">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center shadow-md z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
                  {chatSeller.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  {/* Customer sees the human-readable Store Name here! */}
                  <h3 className="font-bold">{chatSeller.name}</h3>
                  <p className="text-xs text-blue-100 line-clamp-1">Regarding: {chatSeller.productName}</p>
                </div>
              </div>
              <button 
                onClick={() => setChatSeller(null)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="h-80 bg-gray-50 p-4 overflow-y-auto flex flex-col gap-3">
              {chatHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                  <span className="text-4xl mb-2">👋</span>
                  <p className="text-sm">No messages yet.</p>
                  <p className="text-xs">Start the conversation about this product!</p>
                </div>
              ) : (
                chatHistory.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded-2xl max-w-[85%] shadow-sm flex flex-col ${
                      msg.isFromSeller 
                        ? "bg-white border border-gray-200 text-gray-800 self-start rounded-tl-none" 
                        : "bg-blue-600 text-white self-end rounded-br-none"
                    }`}
                  >
                    {msg.isFromSeller && <span className="text-xs font-bold text-gray-900 mb-1">{msg.sellerName}</span>}
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-[10px] text-right mt-1 ${msg.isFromSeller ? "text-gray-400" : "text-blue-200"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                ))
              )}
              <div ref={chatEndRef} /> 
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white flex gap-2">
              <input 
                type="text" 
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900"
                autoFocus
              />
              <button 
                type="submit"
                disabled={!chatMessage.trim()}
                className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}