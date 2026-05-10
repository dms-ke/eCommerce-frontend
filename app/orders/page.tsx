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

  // Chat State
  const [chatSeller, setChatSeller] = useState<{ name: string, id: number, orderId: number, productId: number, productName: string } | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]); 
  const chatEndRef = useRef<HTMLDivElement>(null); 
  const [socket, setSocket] = useState<Socket | null>(null);

  // 🔥 ESCROW STATE ADDED
  // 🔥 NEW DISPUTE STATES
  const [processingEscrowId, setProcessingEscrowId] = useState<number | null>(null);
  
  // We now store the entire Order object so we can extract Product IDs and Seller IDs
  const [selectedOrderForDispute, setSelectedOrderForDispute] = useState<Order | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  
  // New state to hold the uploaded images (as Base64 strings)
  const [disputePhotos, setDisputePhotos] = useState<string[]>([]);

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
    if (order.status === 'PENDING_PAYMENT') return true;
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

  // 🔥 ESCROW ACTION: Confirm Delivery
  const handleConfirmDelivery = async (orderId: number) => {
    if (!confirm("Are you sure you have received this order in good condition? This will instantly release the payment to the seller.")) return;
    
    setProcessingEscrowId(orderId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/payments/${orderId}/confirm-delivery`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to confirm delivery");
      }
      
      setOrders(prevOrders => prevOrders.map(order => 
        order.id === orderId ? { ...order, status: 'DELIVERED' } : order
      ));
      alert("Thank you! Delivery confirmed and funds have been released to the seller.");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcessingEscrowId(null);
    }
  };

  // 🔥 NEW: Handlers for the image upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    // Limit to 3 photos to prevent massive payload sizes
    if (disputePhotos.length + files.length > 3) {
      return alert("You can only upload up to 3 photos.");
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDisputePhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file); // Converts image to Base64 text
    });
  };

  const removePhoto = (index: number) => {
    setDisputePhotos(prev => prev.filter((_, i) => i !== index));
  };


  const submitDispute = async () => {
  if (!selectedOrderForDispute || !disputeReason.trim()) return;
  
  const orderToDispute = selectedOrderForDispute;
  setProcessingEscrowId(orderToDispute.id);
  
  try {
    const token = localStorage.getItem('token');
    const firstItem = orderToDispute.items[0];
    
    const payload = {
      orderId: orderToDispute.id,
      productId: firstItem.product.id,
      productName: firstItem.product.name,
      sellerId: firstItem.product.sellerId || 1, 
      amount: orderToDispute.totalAmount,
      reason: disputeReason,
      photos: disputePhotos 
    };

    const res = await fetch(`http://localhost:3000/disputes`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Failed to open dispute");
    }
    
    setOrders(prevOrders => prevOrders.map(order => 
      order.id === orderToDispute.id ? { ...order, status: 'DISPUTED' } : order
    ));
    
    // Clear Modal states
    setSelectedOrderForDispute(null); // <-- FIXED
    setDisputeReason("");
    setDisputePhotos([]); 
    
    alert("Dispute opened successfully. The seller has been notified with your evidence.");
  } catch (err: any) {
    alert(`Error: ${err.message}`);
  } finally {
    setProcessingEscrowId(null);
  }
};

  useEffect(() => {
    if (chatSeller && socket) {
      const fetchHistory = async () => {
        const token = localStorage.getItem("token");
        try {
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
          sellerId: chatSeller.id,     
          sellerName: chatSeller.name, 
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
                        order.status === 'DELIVERED' ? 'bg-blue-100 text-blue-800' : 
                        order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
                        order.status === 'DISPUTED' ? 'bg-red-100 text-red-800' :
                        order.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                        'bg-purple-100 text-purple-800' // For SHIPPED
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
                                    onClick={() => setChatSeller({ 
                                      name: sellerLabel, 
                                      id: item.product?.sellerId || 4, 
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
                                PENDING_PAYMENT
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

                      {/* ACTIONS AREA */}
                      <div className="mt-6 pt-4 border-t border-gray-200 flex flex-col gap-3">
                        
                        {/* Escrow Buttons - Only show when SHIPPED */}
                        {order.status === 'SHIPPED' && (
                          <div className="flex flex-col gap-2">
                            <button 
                              onClick={() => handleConfirmDelivery(order.id)}
                              disabled={processingEscrowId === order.id}
                              className="w-full bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 transition shadow-sm disabled:opacity-50 flex items-center justify-center"
                            >
                              {processingEscrowId === order.id ? (
                                <span className="animate-pulse">Processing...</span>
                              ) : (
                                <>
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                  Confirm Receipt
                                </>
                              )}
                            </button>
                            
                           <button 
  onClick={() => setSelectedOrderForDispute(order)} // 🔥 Now saves the FULL order object
  className="text-xs text-center text-red-600 hover:text-red-800 underline mt-1 font-medium transition-colors"
>
  Item damaged or not as described? Report an issue
</button>
</div>
)} {/* <--- ADD THESE TWO LINES */}

                        {/* Cancel Order Button */}
                        {isCancellable(order) && (
                          <div>
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DISPUTE MODAL */}
      {selectedOrderForDispute && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl transform transition-all">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Report an Issue</h3>
            <p className="text-sm text-gray-600 text-center mb-6">
              Please describe the problem with your order.
            </p>
            
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 mb-6 text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
              rows={4}
              placeholder="E.g., The item arrived broken, wrong color sent, missing pieces..."
            />

            {/* 👇 👇 👇 PASTE THE NEW UPLOAD EVIDENCE CODE HERE 👇 👇 👇 */}
            <div className="mt-4 mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">Upload Evidence (Max 3)</label>
              
              <div className="flex flex-wrap gap-3">
                {/* Image Previews */}
                {disputePhotos.map((photo, idx) => (
                  <div key={idx} className="relative w-20 h-20 border border-gray-200 rounded-lg overflow-hidden group">
                    <img src={photo} alt="evidence" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  </div>
                ))}

                {/* Upload Button */}
                {disputePhotos.length < 3 && (
                  <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition text-gray-500 hover:text-blue-500">
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    <span className="text-[10px] font-bold">Add Photo</span>
                    <input type="file" multiple accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>
      
            {/* 👆 👆 👆 END OF UPLOAD EVIDENCE CODE 👆 👆 👆 */}
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => { setSelectedOrderForDispute(null); setDisputeReason(""); }}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button 
                onClick={submitDispute}
                disabled={processingEscrowId === selectedOrderForDispute.id  || !disputeReason.trim()}
                className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition flex items-center shadow-sm"
              >
                {processingEscrowId === selectedOrderForDispute.id ? 'Submitting...' : 'Submit Dispute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXISTING CHAT MODAL */}
      {chatSeller && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col transform transition-all">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center shadow-md z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
                  {chatSeller.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
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
