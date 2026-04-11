"use client";

import { useState, useEffect } from "react";
import Link from "next/link"; 
import AddToCartButton from "@/components/AddToCartButton";

type Product = {
  id: number;
  name: string;
  description: string;
  price: string | number;
  stock: number;
  photoUrl?: string; 
  // 🔥 NEW: Add condition and sellerName to type
  condition?: string;
  sellerName?: string;
};

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🔥 NEW: Price formatting helper
  const formatPrice = (amount: number) => {
    return Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const fetchProducts = async (query = "") => {
    setLoading(true);
    setError("");
    
    try {
      const endpoint = query 
        ? `http://localhost:3000/search?q=${encodeURIComponent(query)}` 
        : `http://localhost:3000/products`;
        
      const res = await fetch(endpoint);
      
      if (!res.ok) throw new Error("Failed to fetch products");
      
      const data = await res.json();
      
      let fetchedProducts: Product[] = [];
      
      if (Array.isArray(data)) {
        fetchedProducts = data; 
      } else if (data.products && Array.isArray(data.products)) {
        fetchedProducts = data.products; 
      } else if (data.data && Array.isArray(data.data)) {
        fetchedProducts = data.data; 
      } else if (data.results && Array.isArray(data.results)) {
        fetchedProducts = data.results; 
      } else if (data.hits && Array.isArray(data.hits)) {
        fetchedProducts = data.hits; 
      } else if (data.hits && data.hits.hits && Array.isArray(data.hits.hits)) {
        fetchedProducts = data.hits.hits.map((hit: any) => ({
           id: hit._source.id || hit._id,
           name: hit._source.name,
           description: hit._source.description,
           price: hit._source.price,
           stock: hit._source.stock,
           photoUrl: hit._source.photoUrl,
           // 🔥 NEW: Extract condition and sellerName if returning from search index
           condition: hit._source.condition,
           sellerName: hit._source.sellerName
        }));
      }

      setProducts(fetchedProducts);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(searchQuery);
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      
      {/* HERO & SEARCH SECTION */}
      <div className="bg-blue-600 text-white pt-16 pb-16 px-10 mb-10 shadow-sm">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Find Your Next Device</h1>
          <p className="text-blue-100 mb-8 text-lg">Fast, secure, and reliable tech delivered to your door.</p>
          
          <form onSubmit={handleSearch} className="flex w-full max-w-2xl mx-auto shadow-lg rounded-md overflow-hidden">
            <input 
              type="text" 
              placeholder="Search for laptops, phones, accessories..." 
              className="flex-grow px-6 py-4 text-gray-900 focus:outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button 
              type="submit" 
              className="bg-gray-900 text-white px-8 py-4 font-bold hover:bg-gray-800 transition"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* PRODUCTS GRID SECTION */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10">
        
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800">
            {searchQuery ? `Search Results for "${searchQuery}"` : "Latest Products"}
          </h2>
          {searchQuery && (
            <button 
              onClick={() => { setSearchQuery(""); fetchProducts(""); }}
              className="text-blue-600 hover:underline text-sm font-medium"
            >
              Clear Search
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500 font-medium">Loading products...</div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-6 rounded-md text-center">{error}</div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-gray-100">
            <p className="text-gray-500 mb-2">No products found.</p>
            {searchQuery && <p className="text-sm text-gray-400">Try a different search term.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col hover:shadow-lg transition cursor-pointer group"
              >
                
                {/* 🔥 BUG FIX: Only the Image and Title are wrapped in the Link now! */}
                <Link href={`/products/${product.id}`} className="block">
                  <div className="bg-gray-50 h-48 rounded-md mb-4 flex items-center justify-center text-gray-400 overflow-hidden relative">
                    {product.photoUrl ? (
                      <img 
                        src={`http://localhost:3000${product.photoUrl}`} 
                        alt={product.name}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <span>No Image</span>
                    )}
                  </div>
                  
                  {/* 🔥 UPDATED: Bigger and Bolder text-xl font-extrabold */}
                  <h3 className="text-xl font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors mb-1 line-clamp-2 leading-snug">
                    {product.name}
                  </h3>
                </Link>

                <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-grow mt-1">{product.description}</p>
                
                <div className="flex justify-between items-end mb-4">
                  {/* 🔥 UPDATED: Universal Price Separator implementation */}
                  <span className="text-2xl font-extrabold text-cyan-900">Ksh {formatPrice(Number(product.price))}</span>
                  
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${product.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}
                  </span>
                </div>
                
                <div className="mt-auto border-t border-gray-100 pt-3">
                  <AddToCartButton 
                    product={{
                      id: product.id,
                      name: product.name,
                      price: Number(product.price),
                      photoUrl: product.photoUrl,
                      // 🔥 NEW: Pass condition and sellerName securely to cart!
                      condition: product.condition,
                      sellerName: product.sellerName
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}