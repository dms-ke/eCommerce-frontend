"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { jwtDecode } from "jwt-decode"; // 🔥 NEW: Import for security check

export default function AdminUploadPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false); // 🔥 NEW: Security state

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    discountPercentage: "0",
    shippingOrigin: "Nairobi, Kenya",
    deliveryFee: "250",
    estimatedDelivery: "1-3 Days",
    condition: "Brand New",
    sellerName: "Official Tech Store",
  });
  
  const [files, setFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState({ loading: false, error: "", success: "" });

  // 🔥 NEW: Security Check - Verify admin status before showing the form
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const decoded: any = jwtDecode(token);
      if (decoded.role !== "admin") {
        router.push("/"); // Kick regular users back to the store
      } else {
        setIsAuthorized(true); // Welcome, Admin!
      }
    } catch (error) {
      localStorage.removeItem("token");
      router.push("/login");
    }
  }, [router]);

  // Handle standard text inputs
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle multiple file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(e.target.files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ loading: true, error: "", success: "" });

    // Bundle up the text fields
    const submitData = new FormData();
    submitData.append("name", formData.name);
    submitData.append("description", formData.description);
    submitData.append("price", formData.price);
    submitData.append("stock", formData.stock);
    submitData.append("discountPercentage", formData.discountPercentage);
    submitData.append("shippingOrigin", formData.shippingOrigin);
    submitData.append("deliveryFee", formData.deliveryFee);
    submitData.append("estimatedDelivery", formData.estimatedDelivery);
    submitData.append("condition", formData.condition);
    submitData.append("sellerName", formData.sellerName);
    
    // Loop through all selected files and append them to "photos"
    if (files) {
      for (let i = 0; i < files.length; i++) {
        submitData.append("photos", files[i]); 
      }
    }

    try {
      const token = localStorage.getItem("token");

      const res = await fetch("http://localhost:3000/products", {
        method: "POST",
        headers: {
          // Present the "ID Card" to the NestJS Backend Guard
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: submitData, 
      });

      if (!res.ok) {
        const errData = await res.json();
        const errorMessage = Array.isArray(errData.message) ? errData.message[0] : errData.message;
        throw new Error(errorMessage || "Failed to create product");
      }

      // Success!
      setStatus({ loading: false, error: "", success: "Product added to the catalog successfully!" });
      
      // Clear the form for the next product
      setFormData({ 
        name: "", description: "", price: "", stock: "",
        discountPercentage: "0", shippingOrigin: "Nairobi, Kenya",
        deliveryFee: "250", estimatedDelivery: "1-3 Days",
        condition: "Brand New", sellerName: "Official Tech Store",
      });
      setFiles(null);
      
      // Reset the physical file input field
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

    } catch (err: any) {
      console.error(err);
      setStatus({ loading: false, error: err.message, success: "" });
    }
  };

  // Prevent rendering until authorization is confirmed
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Navigation / Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/dashboard" className="p-2 bg-white rounded-xl border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
            <p className="text-sm text-gray-500">Create a new listing for your storefront.</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          
          {/* Status Messages */}
          {status.error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium flex items-start gap-2">
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <span>{status.error}</span>
            </div>
          )}
          
          {status.success && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm font-medium flex items-start gap-2">
              <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <span>{status.success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Basic Info Section */}
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2">Basic Details</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input type="text" name="name" required value={formData.name} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 transition-shadow" placeholder="e.g. Mechanical Keyboard" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seller Name</label>
                  <input type="text" name="sellerName" required value={formData.sellerName} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 transition-shadow" placeholder="e.g. Official Tech Store" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select name="condition" required value={formData.condition} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white transition-shadow">
                    <option value="Brand New">Brand New</option>
                    <option value="Refurbished">Refurbished</option>
                    <option value="Used - Like New">Used - Like New</option>
                    <option value="Used - Good">Used - Good</option>
                    <option value="Used - Acceptable">Used - Acceptable</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" required rows={4} value={formData.description} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 transition-shadow resize-none" placeholder="Describe the product..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (Ksh)</label>
                  <input type="number" name="price" required min="0" step="0.01" value={formData.price} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 transition-shadow" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                  <input type="number" name="discountPercentage" required min="0" max="100" value={formData.discountPercentage} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 transition-shadow" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                  <input type="number" name="stock" required min="0" value={formData.stock} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 transition-shadow" placeholder="10" />
                </div>
              </div>
            </div>

            {/* Shipping Info Section */}
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2">Shipping Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ships From</label>
                  <input type="text" name="shippingOrigin" required value={formData.shippingOrigin} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 transition-shadow" placeholder="e.g. Nairobi, Kenya" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Fee (Ksh)</label>
                  <input type="number" name="deliveryFee" required min="0" step="0.01" value={formData.deliveryFee} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 transition-shadow" placeholder="250.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Delivery</label>
                  <input type="text" name="estimatedDelivery" required value={formData.estimatedDelivery} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 transition-shadow" placeholder="e.g. 1-3 Days" />
                </div>
              </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-3">
               <h2 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2">Media</h2>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Images (Select multiple)</label>
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:bg-gray-50 transition-colors">
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*"
                  multiple 
                  required
                  onChange={handleFileChange}
                  className="w-full text-gray-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                {files && <p className="text-sm text-green-600 font-medium mt-3">{files.length} file(s) selected and ready for upload.</p>}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={status.loading}
              className="w-full bg-blue-600 text-white font-bold rounded-xl px-4 py-4 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center mt-4"
            >
              {status.loading ? (
                 <span className="flex items-center gap-2">
                   <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                   Uploading to Store...
                 </span>
              ) : "Save Product"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}