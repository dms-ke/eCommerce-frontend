"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation"; 
import { useCart } from "@/context/CartContext"; 
import AddToCartButton from "@/components/AddToCartButton";

type Review = {
  id: number;
  rating: number;
  comment: string;
  reviewerName: string; 
  sellerReply?: string; 
  user?: { id: number; email: string }; 
};

type Product = {
  id: number;
  name: string;
  description: string;
  price: string | number;
  discountPercentage?: number; 
  stock: number;
  shippingOrigin?: string;
  deliveryFee?: number;
  estimatedDelivery?: string;
  photoUrl?: string;
  gallery?: string[];
  reviews?: Review[];
  // 🔥 NEW: Added condition and sellerName to the type
  condition?: string;
  sellerName?: string;
};

export default function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const router = useRouter();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [isAdmin, setIsAdmin] = useState(false); 
  const [currentUserId, setCurrentUserId] = useState<number | null>(null); 

  const [activeImage, setActiveImage] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1); 

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewName, setReviewName] = useState(""); 
  const [reviewComment, setReviewComment] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");

  const [replyTexts, setReplyTexts] = useState<{ [key: number]: string }>({});
  const [replyingTo, setReplyingTo] = useState<number | null>(null);

  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState("");
  const [editName, setEditName] = useState("");

  // 🔥 NEW: Price formatting helper
  const formatPrice = (amount: number) => {
    return Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const fetchSingleProduct = async () => {
    try {
      const res = await fetch(`http://localhost:3000/products/${productId}`);
      if (!res.ok) throw new Error("Product not found");
      const data = await res.json();
      setProduct(data);
      setActiveImage(data.gallery && data.gallery.length > 0 ? data.gallery[0] : data.photoUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSingleProduct();
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserId(payload.sub || payload.userId || payload.id); 
        if (payload.roles?.includes('admin') || payload.role === 'admin') {
          setIsAdmin(true);
        }
      } catch (e) { console.error("Could not parse token"); }
    }
  }, [productId]);

  const handleQuantityChange = (type: 'increase' | 'decrease') => {
    if (!product) return;
    if (type === 'increase' && quantity < product.stock) {
      setQuantity(prev => prev + 1);
    } else if (type === 'decrease' && quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const handleQuantityInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!product) return;
    const val = parseInt(e.target.value);
    if (!isNaN(val)) {
      if (val < 1) setQuantity(1);
      else if (val > product.stock) setQuantity(product.stock);
      else setQuantity(val);
    } else {
      setQuantity(1); 
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewStatus("Submitting...");
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("You must be logged in to leave a review.");
      const res = await fetch(`http://localhost:3000/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment, reviewerName: reviewName })
      });
      if (!res.ok) throw new Error("Failed to submit review");
      setReviewStatus("Review added successfully! 🎉");
      setReviewComment(""); setReviewName(""); setReviewRating(5);
      fetchSingleProduct(); 
    } catch (err: any) { setReviewStatus(`Error: ${err.message}`); }
  };

  const submitReply = async (reviewId: number) => {
    try {
      const token = localStorage.getItem("token");
      const text = replyTexts[reviewId];
      if (!text) return;
      const res = await fetch(`http://localhost:3000/products/reviews/${reviewId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ reply: text })
      });
      if (!res.ok) throw new Error("Failed to submit reply");
      setReplyingTo(null); fetchSingleProduct(); 
    } catch (err: any) { alert(`Error replying: ${err.message}`); }
  };

  const saveEditReview = async (reviewId: number) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:3000/products/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ rating: editRating, comment: editComment, reviewerName: editName })
      });
      if (!res.ok) throw new Error("Failed to update review");
      setEditingReviewId(null); fetchSingleProduct();
    } catch (err: any) { alert(`Error updating: ${err.message}`); }
  };

  const deleteReview = async (reviewId: number) => {
    if (!confirm("Are you sure you want to delete this review?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:3000/products/reviews/${reviewId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete review");
      fetchSingleProduct();
    } catch (err: any) { alert(`Error deleting: ${err.message}`); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><p className="text-xl text-gray-500">Loading...</p></div>;
  if (error || !product) return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100"><h1 className="text-2xl text-red-600 mb-4">{error}</h1><Link href="/" className="text-blue-600">← Back to Store</Link></div>;

  const images = product.gallery && product.gallery.length > 0 ? product.gallery : (product.photoUrl ? [product.photoUrl] : []);
  
  const reviewCount = product.reviews?.length || 0;
  const averageRating = reviewCount > 0 
    ? product.reviews!.reduce((sum, rev) => sum + rev.rating, 0) / reviewCount 
    : 0;

  const hasDiscount = product.discountPercentage && product.discountPercentage > 0;
  const originalPrice = hasDiscount ? (Number(product.price) * 100) / (100 - product.discountPercentage!) : Number(product.price);

  return (
    <main className="min-h-screen bg-gray-100 pb-12">
      
      {/* Top Navigation Bar */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <div className="flex-grow flex bg-gray-100 rounded-full px-4 py-2">
            <input type="text" placeholder="Search products..." className="bg-transparent border-none outline-none w-full text-sm" disabled />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-3 pt-3 px-0 sm:px-4">
        
        {/* =========================================
            LEFT COLUMN: Images & Reviews
            ========================================= */}
        <div className="w-full md:w-[45%] flex flex-col gap-3">
          
          {/* Image Gallery Card */}
          <div className="bg-white md:rounded-lg overflow-hidden flex flex-col">
            <div className="bg-gray-50 aspect-square flex items-center justify-center relative">
              {activeImage ? (
                <img src={`http://localhost:3000${activeImage}`} alt={product.name} className="object-contain w-full h-full absolute inset-0" />
              ) : (
                <span className="text-gray-400">No Image</span>
              )}
              {hasDiscount && (
                <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-sm shadow-sm">
                  -{product.discountPercentage}% OFF
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3 border-t border-gray-50">
                {images.map((img, idx) => (
                  <button key={idx} onClick={() => setActiveImage(img)} className={`h-14 w-14 flex-shrink-0 rounded-md overflow-hidden border-2 transition-colors ${activeImage === img ? 'border-orange-500' : 'border-transparent'}`}>
                    <img src={`http://localhost:3000${img}`} alt="Thumbnail" className="object-cover w-full h-full" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reviews Card */}
          <div className="bg-white md:rounded-lg p-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-600 inline-block rounded-full"></span>
                Customer Reviews ({reviewCount})
              </div>
            </h2>

            {(!product.reviews || product.reviews.length === 0) ? (
              <p className="text-gray-500 text-sm italic text-center py-6 bg-gray-50 rounded">No reviews yet.</p>
            ) : (
              <div className="space-y-4 mb-6">
                {product.reviews.map((review) => {
                  const canEditOrDelete = isAdmin || (review.user && review.user.id === currentUserId);
                  return (
                    <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 relative group">
                      {editingReviewId === review.id ? (
                        <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                          <select value={editRating} onChange={e => setEditRating(Number(e.target.value))} className="mb-2 w-full p-2 border rounded text-xs text-gray-900">
                            <option value="5">5 Stars</option><option value="4">4 Stars</option><option value="3">3 Stars</option><option value="2">2 Stars</option><option value="1">1 Star</option>
                          </select>
                          <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name" className="mb-2 w-full p-2 border rounded text-xs text-gray-900"/>
                          <textarea value={editComment} onChange={e => setEditComment(e.target.value)} rows={2} className="w-full p-2 border rounded text-xs mb-2 text-gray-900"></textarea>
                          <div className="flex gap-2">
                            <button onClick={() => saveEditReview(review.id)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold">Save</button>
                            <button onClick={() => setEditingReviewId(null)} className="bg-gray-300 text-gray-800 px-3 py-1 rounded text-xs">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-yellow-400 text-xs">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                              <span className="text-xs font-medium text-gray-700">{review.reviewerName || "Anonymous"}</span>
                            </div>
                            {canEditOrDelete && (
                              <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingReviewId(review.id); setEditRating(review.rating); setEditComment(review.comment); setEditName(review.reviewerName); }} className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Edit</button>
                                <button onClick={() => deleteReview(review.id)} className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">Delete</button>
                              </div>
                            )}
                          </div>
                          <p className="text-gray-800 text-sm mb-2">{review.comment}</p>
                          {review.sellerReply && (
                            <div className="bg-gray-50 border-l-2 border-blue-500 p-2 mt-2 rounded-r text-xs">
                              <span className="font-bold text-blue-800 mr-1">Seller:</span>
                              <span className="text-gray-700">{review.sellerReply}</span>
                            </div>
                          )}
                          {isAdmin && !review.sellerReply && (
                            <div className="mt-2">
                              {replyingTo === review.id ? (
                                <div className="flex gap-2">
                                  <input type="text" placeholder="Reply..." className="flex-grow text-xs border border-gray-300 rounded px-2 py-1 text-gray-900" value={replyTexts[review.id] || ""} onChange={(e) => setReplyTexts({...replyTexts, [review.id]: e.target.value})} />
                                  <button onClick={() => submitReply(review.id)} className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">Send</button>
                                </div>
                              ) : (
                                <button onClick={() => setReplyingTo(review.id)} className="text-[10px] text-blue-600 font-medium">↳ Reply</button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Write a Review</h3>
              <form onSubmit={submitReview} className="space-y-3">
                <div className="flex gap-3">
                  <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} className="w-1/3 border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900">
                    <option value="5">5 Stars</option><option value="4">4 Stars</option><option value="3">3 Stars</option><option value="2">2 Stars</option><option value="1">1 Star</option>
                  </select>
                  <input type="text" value={reviewName} onChange={(e) => setReviewName(e.target.value)} className="w-2/3 border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900" placeholder="Name (Optional)" />
                </div>
                <textarea required rows={2} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900" placeholder="What did you think?"></textarea>
                <button type="submit" className="w-full bg-blue-600 text-white font-bold px-4 py-2 rounded text-sm hover:bg-blue-700 transition">Submit Review</button>
                {reviewStatus && <p className={`text-xs mt-1 text-center font-medium ${reviewStatus.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>{reviewStatus}</p>}
              </form>
            </div>
          </div>

        </div>

        {/* =========================================
            RIGHT COLUMN: Details & Actions
            ========================================= */}
        <div className="w-full md:w-[55%] flex flex-col gap-3">
          
          <div className="bg-white md:rounded-lg p-4 shadow-sm">
            <div className="flex items-end gap-2 mb-2">
              {/* 🔥 UPDATED: Added comma formatting */}
              <span className="text-3xl font-extrabold text-orange-600">
                <span className="text-lg">Ksh</span> {formatPrice(Number(product.price))}
              </span>
              
              {hasDiscount && (
                <span className="text-sm text-gray-400 line-through mb-1">
                  Ksh {formatPrice(originalPrice)}
                </span>
              )}
            </div>
            
            <h1 className="text-lg font-bold text-gray-900 leading-snug mb-3">
              <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded mr-2 align-middle">MALL</span>
              {product.name}
            </h1>

            {/* 🔥 NEW: Added visible Seller and Condition info */}
            <div className="flex flex-col gap-1 mb-2 border-t border-gray-100 pt-3">
              <p className="text-sm text-gray-600">
                Seller: <span className="font-bold text-blue-600 cursor-pointer hover:underline">{product.sellerName || "Official Tech Store"}</span>
              </p>
              <p className="text-sm text-gray-600">
                Condition: <span className="font-bold text-gray-900">{product.condition || "Brand New"}</span>
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-1">
              <div className="flex items-center gap-1">
                <span className="text-yellow-400 text-sm">
                  {'★'.repeat(Math.round(averageRating))}{'☆'.repeat(5 - Math.round(averageRating))}
                </span>
                <span className="text-xs text-blue-600 font-medium ml-1">{averageRating.toFixed(1)}</span>
                <span className="text-xs text-gray-500 ml-1">({reviewCount} Reviews)</span>
              </div>
            </div>
          </div>

          <div className="bg-white md:rounded-lg p-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="text-gray-400 mt-0.5">🚚</span>
              <div>
                <p className="text-sm font-bold text-gray-800">
                  Shipped from {product.shippingOrigin || 'Nairobi, Kenya'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {/* 🔥 UPDATED: Added comma formatting to delivery fee */}
                  Delivery Fee: Ksh {product.deliveryFee !== undefined ? formatPrice(Number(product.deliveryFee)) : '250.00'} 
                  {' '}(Estimated {product.estimatedDelivery || '1-3 Days'})
                </p>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3 flex flex-wrap gap-x-4 gap-y-2">
              <span className="text-xs text-gray-600 flex items-center gap-1">✅ 7 Days Return</span>
              <span className="text-xs text-gray-600 flex items-center gap-1">✅ 100% Authentic</span>
              <span className="text-xs text-gray-600 flex items-center gap-1">✅ Secure Payment</span>
            </div>
          </div>

          <div className="bg-white md:rounded-lg p-4 shadow-sm flex flex-col gap-4">
            
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700 w-16">Quantity</span>
              <div className="flex items-center border border-gray-300 rounded-md bg-white">
                <button 
                  onClick={() => handleQuantityChange('decrease')} 
                  disabled={quantity <= 1}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent font-medium"
                >
                  -
                </button>
                <input 
                  type="number" 
                  value={quantity} 
                  onChange={handleQuantityInput}
                  className="w-12 text-center text-sm font-medium text-gray-900 border-x border-gray-300 py-1 outline-none appearance-none" 
                  min="1"
                  max={product.stock}
                />
                <button 
                  onClick={() => handleQuantityChange('increase')} 
                  disabled={quantity >= product.stock}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent font-medium"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-gray-500">{product.stock > 0 ? `${product.stock} pieces available` : 'Out of stock'}</span>
            </div>

            <div className="flex gap-2 mt-2">
              <div className="flex-1">
                {/* 🔥 UPDATED: Added condition and sellerName to the AddToCartButton payload */}
                <AddToCartButton 
                  product={{ 
                    id: product.id, 
                    name: product.name, 
                    price: Number(product.price), 
                    photoUrl: activeImage,
                    condition: product.condition,
                    sellerName: product.sellerName
                  }} 
                  quantity={quantity} 
                />
              </div>
              <button 
                onClick={() => {
                  // 🔥 UPDATED: Added condition and sellerName to the manual addToCart payload
                  addToCart({ 
                    id: product.id, 
                    name: product.name, 
                    price: Number(product.price), 
                    quantity, 
                    photoUrl: activeImage,
                    condition: product.condition,
                    sellerName: product.sellerName 
                  });
                  router.push('/cart'); 
                }}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm shadow-sm"
              >
                Buy Now
              </button>
            </div>
          </div>

          <div className="bg-white md:rounded-lg p-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-600 inline-block rounded-full"></span>
              Product Details
            </h2>
            <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {product.description}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}