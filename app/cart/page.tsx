"use client";

import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type ShippingAddress = {
  id: string;
  fullName: string;
  phoneNumber: string;
  streetAddress: string;
  city: string;
  isDefault: boolean;
};

export default function CartPage() {
  const router = useRouter();
  
  const { cart, cartCount, clearCart, removeFromCart, updateQuantity } = useCart(); 
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const [savedItems, setSavedItems] = useState<any[]>([]);

  // Advanced Shipping States
  const [savedAddresses, setSavedAddresses] = useState<ShippingAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    fullName: "",
    phoneNumber: "",
    streetAddress: "",
    city: "",
  });
  
  const [isLocating, setIsLocating] = useState(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null); 
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null); 

  // 🔥 NEW: Delivery Method State
  const [deliveryMethod, setDeliveryMethod] = useState<'VENDOR' | 'PLATFORM'>('VENDOR');

  // 🔥 NEW: Dynamic Logistics States
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [shippingDuration, setShippingDuration] = useState<string>("");
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [shippingError, setShippingError] = useState("");

  const activeCartItems = cart.filter(item => !savedItems.find(saved => saved.id === item.id));
  const subtotal = activeCartItems.reduce((total, item) => total + item.price * item.quantity, 0);

  const selectedAddress = savedAddresses.find(a => a.id === selectedAddressId);
  
  const totalPrice = subtotal + shippingFee;

  const formatPrice = (amount: number) => {
    return Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // ========================================================
  // 🔥 DYNAMIC SHIPPING LOGIC (Google Maps Distance Matrix)
  // ========================================================
  useEffect(() => {
    const fetchShippingEstimate = async () => {
      if (!selectedAddress || activeCartItems.length === 0) return;

      setIsCalculatingShipping(true);
      setShippingError("");

      try {
        // NOTE: If cart has multiple vendors, this currently picks the first item's vendor.
        // You can expand this later to loop through vendors and calculate multiple fees if needed!
        const firstItem = activeCartItems[0] as any;
        const vendorLocation = firstItem?.location 
          ? `${firstItem.location}, Kenya` 
          : "CBD, Nakuru, Kenya"; // Fallback origin
          
        const buyerLocation = `${selectedAddress.streetAddress}, ${selectedAddress.city}, Kenya`;

        const res = await fetch(
          `http://localhost:3000/logistics/estimate?origin=${encodeURIComponent(vendorLocation)}&destination=${encodeURIComponent(buyerLocation)}`
        );

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Failed to calculate shipping.");

        setShippingFee(data.shippingFee || 0);
        setShippingDuration(data.estimatedDuration || "");

      } catch (err: any) {
        console.error(err);
        setShippingError(err.message || "Delivery route not found.");
        setShippingFee(0);
        setShippingDuration("");
      } finally {
        setIsCalculatingShipping(false);
      }
    };

    fetchShippingEstimate();
  }, [selectedAddressId, activeCartItems.length]); // Auto-calculates anytime address or cart changes!

  // ========================================================
  // ADDRESS MANAGEMENT
  // ========================================================
  useEffect(() => {
    const fetchAddresses = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setIsLoadingAddresses(false);
        return; 
      }

      try {
        const res = await fetch("http://localhost:3000/addresses", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setSavedAddresses(data);
          
          const defaultAddr = data.find((a: ShippingAddress) => a.isDefault);
          if (defaultAddr) setSelectedAddressId(defaultAddr.id);
          else if (data.length > 0) setSelectedAddressId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch addresses:", err);
      } finally {
        setIsLoadingAddresses(false);
      }
    };

    fetchAddresses();
  }, []);

  const handleSaveForLater = (item: any) => {
    if (!savedItems.find(saved => saved.id === item.id)) {
      setSavedItems([...savedItems, item]);
    }
  };

  const handleMoveToCart = (item: any) => {
    setSavedItems(savedItems.filter(saved => saved.id !== item.id));
  };

  const GOOGLE_MAPS_API_KEY = "AIzaSyAGZtmQnf8nx3ptq8pYn-Umd5S896Q7Do4"; 
  
  const autoLocateCustomer = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`);
            const data = await res.json();
            
            if (data.results && data.results.length > 0) {
              const formattedAddress = data.results[0].formatted_address;
              const addressParts = formattedAddress.split(",");
              const cityEstimate = addressParts.length > 1 ? addressParts[addressParts.length - 2].trim() : "Nairobi";

              setNewAddress(prev => ({
                ...prev,
                streetAddress: formattedAddress,
                city: cityEstimate
              }));
              setMessage({ type: 'success', text: "Location successfully detected!" });
            }
          } catch (error) {
            setMessage({ type: 'error', text: "Could not fetch address from Google Maps." });
          } finally {
            setIsLocating(false);
          }
        },
        (error) => {
          setIsLocating(false);
          setMessage({ type: 'error', text: "Location access denied. Please enter manually." });
        }
      );
    } else {
      setIsLocating(false);
      setMessage({ type: 'error', text: "Geolocation is not supported by your browser." });
    }
  };

  const handleEditClick = (e: React.MouseEvent, address: ShippingAddress) => {
    e.stopPropagation();
    setNewAddress({
      fullName: address.fullName,
      phoneNumber: address.phoneNumber,
      streetAddress: address.streetAddress,
      city: address.city
    });
    setEditingAddressId(address.id);
    setShowAddressForm(true);
    setMessage(null);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    
    const token = localStorage.getItem("token");
    if (!token) {
      setMessage({ type: 'error', text: "Please log in to save a shipping address." });
      setTimeout(() => router.push("/login"), 2000);
      return;
    }

    const isFirstAddress = savedAddresses.length === 0;
    const addressPayload = {
      ...newAddress,
      isDefault: editingAddressId ? undefined : isFirstAddress, 
    };

    try {
      const url = editingAddressId 
        ? `http://localhost:3000/addresses/${editingAddressId}` 
        : "http://localhost:3000/addresses";
      
      const method = editingAddressId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(addressPayload)
      });

      if (!res.ok) throw new Error("Failed to save address to database.");
      
      const savedDbAddress = await res.json(); 

      if (editingAddressId) {
        setSavedAddresses(prev => prev.map(a => a.id === editingAddressId ? savedDbAddress : a));
        setMessage({ type: 'success', text: "Address updated successfully!" });
      } else {
        setSavedAddresses([...savedAddresses, savedDbAddress]);
        setSelectedAddressId(savedDbAddress.id);
        setMessage({ type: 'success', text: "Address saved successfully!" });
      }

      setShowAddressForm(false);
      setEditingAddressId(null);
      setNewAddress({ fullName: "", phoneNumber: "", streetAddress: "", city: "" }); 

    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteAddress = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    
    if (!window.confirm("Are you sure you want to delete this address?")) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    setIsDeletingId(id);
    setMessage(null);

    try {
      const res = await fetch(`http://localhost:3000/addresses/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Failed to delete address.");

      const updatedAddresses = savedAddresses.filter(a => a.id !== id);
      setSavedAddresses(updatedAddresses);

      if (selectedAddressId === id) {
        const nextDefault = updatedAddresses.find(a => a.isDefault);
        if (nextDefault) setSelectedAddressId(nextDefault.id);
        else if (updatedAddresses.length > 0) setSelectedAddressId(updatedAddresses[0].id);
        else setSelectedAddressId(""); 
      }

      if (editingAddressId === id) {
        setShowAddressForm(false);
        setEditingAddressId(null);
      }

      setMessage({ type: 'success', text: "Address deleted successfully." });

    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsDeletingId(null);
    }
  };

  // ========================================================
  // INTASEND CHECKOUT LOGIC
  // ========================================================
  const handleCheckout = async () => {
    if (!selectedAddress) {
      setMessage({ type: 'error', text: "Please select a shipping address before proceeding." });
      return;
    }
    
    if (isCalculatingShipping) {
      setMessage({ type: 'error', text: "Please wait for shipping calculation to complete." });
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setMessage({ type: 'error', text: "You must be logged in to checkout." });
      setTimeout(() => router.push("/login"), 2000);
      return;
    }

    setIsCheckingOut(true);
    setMessage(null);

    try {
      // 1. Create the Order in your database
      const orderData = {
        phoneNumber: selectedAddress.phoneNumber, 
        paymentMethod: "INTASEND", 
        shippingAddress: selectedAddress, 
        shippingFee: shippingFee, 
        deliveryMethod: deliveryMethod, 
        items: activeCartItems.map(item => ({
          productId: item.id,
          quantity: item.quantity
        }))
      };

      const orderRes = await fetch("http://localhost:3000/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(orderData),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json();
        throw new Error(errData.message || "Failed to place order.");
      }

      // 🔥 FIX: Extract the payload properly
      const createdOrderResponse = await orderRes.json(); 
      const actualOrder = createdOrderResponse.order; // Drill down into the nested 'order' object

      if (!actualOrder || !actualOrder.id) {
        throw new Error("Server failed to return a valid Order ID.");
      }

      // 2. Prepare IntaSend Payload
      const paymentPayload = {
        order: {
          id: actualOrder.id, // 🔥 GUARANTEED to be the real Database ID (e.g., 150)
          totalAmount: totalPrice,
          sellerId: activeCartItems[0]?.sellerId || 1, 
          shippingFee: shippingFee, 
        },
        customer: {
          email: "customer@example.com", 
          name: selectedAddress.fullName,
        }
      };

      // 3. Hit the NestJS /payments/checkout endpoint we just built
      const paymentRes = await fetch("http://localhost:3000/payments/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(paymentPayload),
      });

      const paymentData = await paymentRes.json();

      // 4. Clear the cart and Redirect user to IntaSend!
      if (paymentData.url) {
        setMessage({ type: 'success', text: "Connecting securely to Payment Gateway..." });
        clearCart();
        window.location.href = paymentData.url; 
      } else {
        throw new Error("Failed to generate secure checkout link.");
      }
      
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
      setIsCheckingOut(false);
    }
  };

  if (cart.length === 0 && savedItems.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-gray-50 px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">You don't have any items in your cart.</h1>
        <p className="text-gray-600 mb-8 text-center">Have an account? Sign in to see your items.</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/" className="bg-white border-2 border-blue-600 text-blue-600 px-8 py-3 rounded-full font-bold hover:bg-blue-50 transition">
            Start shopping
          </Link>
          <Link href="/login" className="bg-blue-600 border-2 border-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 transition">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* =========================================
            LEFT COLUMN: Cart Items & Address Mgt
            ========================================= */}
        <div className="flex-grow lg:w-2/3">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Shopping cart</h1>
          
          <div className="flex items-center gap-3 p-4 bg-white rounded-t-xl border border-gray-200 border-b-0">
            <input type="checkbox" className="w-5 h-5 accent-blue-600 rounded cursor-pointer" defaultChecked />
            <span className="text-gray-900 font-medium text-lg">Select all ({activeCartItems.length} items)</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-b-xl shadow-sm mb-8">
            {activeCartItems.map((item, index) => (
              <div key={item.id} className={`p-6 ${index !== activeCartItems.length - 1 ? 'border-b border-gray-200' : ''}`}>
                
                <div className="flex items-center gap-2 mb-4 text-sm">
                  <span className="text-gray-700 font-medium">
                    Seller: <span className="text-gray-900 underline cursor-pointer hover:text-blue-600">{item.sellerName || "OfficialStore"}</span>
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex items-start gap-4 sm:w-[25%] flex-shrink-0">
                    <input type="checkbox" className="w-5 h-5 accent-blue-600 rounded cursor-pointer mt-1" defaultChecked />
                    <div className="w-full aspect-square max-w-[140px] bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden relative">
                       {item.photoUrl ? (
                         <img src={`http://localhost:3000${item.photoUrl}`} alt={item.name} className="object-cover w-full h-full absolute inset-0" />
                       ) : (
                         <div className="text-gray-400 text-xs text-center px-2">No Image</div>
                       )}
                    </div>
                  </div>

                  <div className="flex-grow sm:w-[45%] flex flex-col justify-between">
                    <div>
                      <Link href={`/products/${item.id}`} className="text-lg font-bold text-gray-900 leading-tight mb-2 hover:underline line-clamp-2">
                        {item.name}
                      </Link>
                      <p className="text-sm text-gray-500 mb-1">
                        Condition: <span className="text-gray-900 font-medium">{item.condition || "Brand New"}</span>
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4 mt-6 text-sm font-medium">
                      <button onClick={() => handleSaveForLater(item)} className="text-blue-600 hover:underline">
                        Save for later
                      </button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => removeFromCart(item.id)} className="text-blue-600 hover:underline">
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="sm:w-[30%] flex flex-col items-end text-right">
                    <div className="mb-4">
                      <span className="text-2xl font-bold text-gray-900 block">Ksh {formatPrice(item.price * item.quantity)}</span>
                    </div>
                    
                    <div className="flex items-center border border-gray-300 rounded-md bg-white hover:border-gray-400 transition-colors">
                       <span className="px-3 py-1.5 text-gray-600 text-sm border-r border-gray-300 bg-gray-50 rounded-l-md">Qty</span>
                       <select 
                         className="px-3 py-1.5 text-gray-900 bg-transparent outline-none cursor-pointer font-medium"
                         value={item.quantity}
                         onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                       >
                         {[...Array(20)].map((_, i) => (
                           <option key={i+1} value={i+1}>{i+1}</option>
                         ))}
                       </select>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>

          {activeCartItems.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-8 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-900">Delivery Details</h2>
                {(!showAddressForm && savedAddresses.length > 0) && (
                  <button onClick={() => {
                    setEditingAddressId(null);
                    setNewAddress({ fullName: "", phoneNumber: "", streetAddress: "", city: "" });
                    setShowAddressForm(true);
                  }} className="text-sm font-bold text-blue-600 hover:underline">
                    + Add New Address
                  </button>
                )}
              </div>

              <div className="p-6">
                {isLoadingAddresses ? (
                  <div className="text-center py-4 text-gray-500">Loading your saved addresses...</div>
                ) : (
                  <>
                    {!showAddressForm && savedAddresses.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {savedAddresses.map((address) => (
                          <div 
                            key={address.id} 
                            onClick={() => setSelectedAddressId(address.id)}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition relative group ${selectedAddressId === address.id ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:border-blue-300'}`}
                          >
                            {selectedAddressId === address.id && (
                              <div className="absolute top-4 right-4 text-blue-600">
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                              </div>
                            )}
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-gray-900">{address.fullName}</span>
                              
                              <div className={`flex gap-2 transition-opacity ${selectedAddressId === address.id ? 'opacity-100 mr-8' : 'opacity-0 group-hover:opacity-100'}`}>
                                <button 
                                  onClick={(e) => handleEditClick(e, address)}
                                  className="text-blue-500 hover:text-blue-700 p-1"
                                  title="Edit Address"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                </button>
                                
                                <button 
                                  onClick={(e) => handleDeleteAddress(e, address.id)}
                                  disabled={isDeletingId === address.id}
                                  className="text-red-400 hover:text-red-600 p-1"
                                  title="Delete Address"
                                >
                                  {isDeletingId === address.id ? (
                                    <svg className="animate-spin h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                  )}
                                </button>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">{address.streetAddress}, {address.city}</p>
                            <p className="text-sm text-gray-900 font-medium">📞 {address.phoneNumber}</p>
                            {address.isDefault && <span className="inline-block mt-2 bg-gray-200 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Default Address</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {(showAddressForm || savedAddresses.length === 0) && (
                      <form onSubmit={handleSaveAddress} className="space-y-4 mt-6">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                          <h3 className="font-bold text-gray-800">{editingAddressId ? "Edit Address" : "Enter New Address"}</h3>
                          {!editingAddressId && (
                            <button 
                              type="button" 
                              onClick={autoLocateCustomer}
                              disabled={isLocating}
                              className="flex items-center gap-2 text-xs font-bold bg-blue-50 text-blue-600 px-3 py-2 rounded border border-blue-200 hover:bg-blue-100 transition disabled:opacity-50"
                            >
                              {isLocating ? "📍 Locating..." : "📍 Use My Location"}
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input type="text" required value={newAddress.fullName} onChange={e => setNewAddress({...newAddress, fullName: e.target.value})} className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-600 text-sm text-gray-900 bg-white" placeholder="e.g. Daniel Samson"/>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">M-Pesa Phone Number</label>
                            <input type="text" required value={newAddress.phoneNumber} onChange={e => setNewAddress({...newAddress, phoneNumber: e.target.value})} className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-600 text-sm text-gray-900 bg-white" placeholder="e.g. 254700000000"/>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                          <input type="text" required value={newAddress.streetAddress} onChange={e => setNewAddress({...newAddress, streetAddress: e.target.value})} className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-600 text-sm text-gray-900 bg-white" placeholder="e.g. Moi Avenue, Biashara Street"/>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">City / Region</label>
                          <input type="text" required value={newAddress.city} onChange={e => setNewAddress({...newAddress, city: e.target.value})} className="w-full border border-gray-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-600 text-sm text-gray-900 bg-white" placeholder="e.g. Nairobi"/>
                        </div>

                        <div className="flex gap-3 pt-4">
                          <button type="submit" className="bg-gray-900 text-white font-bold px-6 py-2.5 rounded-md hover:bg-gray-800 transition">
                            {editingAddressId ? "Update Address" : "Save Address"}
                          </button>
                          {(savedAddresses.length > 0) && (
                            <button type="button" onClick={() => {
                              setShowAddressForm(false);
                              setEditingAddressId(null);
                            }} className="text-gray-700 font-medium px-4 py-2 hover:bg-gray-100 rounded-md transition">Cancel</button>
                          )}
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Saved for Later Section */}
          {savedItems.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Saved for later ({savedItems.length})</h2>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-200">
                {savedItems.map((item) => (
                  <div key={`saved-${item.id}`} className="p-6 flex flex-col sm:flex-row gap-6 opacity-75 hover:opacity-100 transition-opacity">
                    <div className="w-24 h-24 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden grayscale relative">
                      {item.photoUrl ? (
                        <img src={`http://localhost:3000${item.photoUrl}`} alt={item.name} className="object-cover w-full h-full absolute inset-0" />
                      ) : (
                        <span className="text-xs text-gray-400">No Image</span>
                      )}
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{item.name}</h3>
                      <span className="text-xl font-bold text-gray-700">Ksh {formatPrice(item.price)}</span>
                    </div>
                    <div className="flex items-center">
                      <button 
                        onClick={() => handleMoveToCart(item)}
                        className="px-4 py-2 border-2 border-blue-600 text-blue-600 font-bold rounded-full hover:bg-blue-50 transition"
                      >
                        Move to Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* =========================================
            RIGHT COLUMN: Order Summary & Checkout
            ========================================= */}
        <div className="lg:w-1/3">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm sticky top-24">
            
            {message && (
              <div className={`mb-6 p-4 rounded-md font-medium text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                {message.text}
              </div>
            )}

            <div className="space-y-4 text-gray-700 text-base mb-6">
              <div className="flex justify-between">
                <span>Items ({activeCartItems.length})</span>
                <span>Ksh {formatPrice(subtotal)}</span>
              </div>
              
              {/* 🔥 UPDATED: Dynamic Shipping Display */}
              <div className={`flex justify-between items-center pb-4 border-b border-gray-100 ${shippingDuration ? '' : 'border-b'}`}>
                <span>Shipping Fee</span>
                <span className="font-medium text-gray-900">
                  {isCalculatingShipping ? (
                    <span className="text-blue-500 text-sm italic animate-pulse">Calculating...</span>
                  ) : selectedAddress ? (
                    `Ksh ${formatPrice(shippingFee)}`
                  ) : (
                    <span className="text-orange-500 text-sm italic">Select Address</span>
                  )}
                </span>
              </div>
              
              {shippingDuration && !isCalculatingShipping && (
                 <div className="flex justify-between items-center pb-4 border-b border-gray-100 text-sm">
                   <span className="text-gray-500">Est. Delivery</span>
                   <span className="font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">{shippingDuration}</span>
                 </div>
              )}

              {shippingError && (
                 <div className="pb-2 text-xs text-red-500 text-right font-bold">
                   {shippingError}
                 </div>
              )}
              
              <div className="flex justify-between items-end pt-2">
                <span className="text-xl font-bold text-gray-900">Total</span>
                <span className="text-3xl font-bold text-gray-900">
                  {isCalculatingShipping ? "..." : `Ksh ${formatPrice(totalPrice)}`}
                </span>
              </div>
            </div>

            {/* 🔥 NEW: Delivery Method Selection */}
            <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Delivery Method</h3>
              <div className="space-y-3">
                
                {/* Vendor Delivery Option */}
                <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${deliveryMethod === 'VENDOR' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input 
                    type="radio" 
                    name="deliveryMethod" 
                    value="VENDOR" 
                    checked={deliveryMethod === 'VENDOR'} 
                    onChange={() => setDeliveryMethod('VENDOR')} 
                    className="w-4 h-4 text-green-600 bg-white border-gray-300 focus:ring-green-500"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-900">Standard Delivery</span>
                    <span className="block text-xs text-gray-500">The seller handles the shipping and delivery directly to you.</span>
                  </div>
                </label>

                {/* Platform Delivery Option */}
                <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${deliveryMethod === 'PLATFORM' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input 
                    type="radio" 
                    name="deliveryMethod" 
                    value="PLATFORM" 
                    checked={deliveryMethod === 'PLATFORM'} 
                    onChange={() => setDeliveryMethod('PLATFORM')} 
                    className="w-4 h-4 text-green-600 bg-white border-gray-300 focus:ring-green-500"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-900">Premium Platform Delivery</span>
                    <span className="block text-xs text-gray-500">Our platform handles the logistics for faster, secure delivery.</span>
                  </div>
                </label>

              </div>
            </div>

            <button 
              onClick={handleCheckout}
              disabled={isCheckingOut || isCalculatingShipping || activeCartItems.length === 0 || !selectedAddress}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-4 rounded-full transition-colors text-lg shadow-sm flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isCheckingOut ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Connecting securely...
                </span>
              ) : "Pay Now (M-Pesa / Card)"}
            </button>

            <p className="text-xs text-center text-gray-500 mt-4">
              {selectedAddress 
                ? "You will be redirected securely to pay via M-Pesa, Visa, Mastercard, or PesaLink." 
                : "Please select an address to enable checkout."}
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}