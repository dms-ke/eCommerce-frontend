'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get('invoice_id'); 
  const orderId = searchParams.get('orderId');      

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const router = useRouter();

  useEffect(() => {
    // FIX: Proceed if we have AT LEAST ONE of the IDs
    if (!invoiceId && !orderId) {
        const timeout = setTimeout(() => {
             if (!searchParams.get('invoice_id') && !searchParams.get('orderId')) {
                 setStatus('error');
             }
        }, 3000);
        return () => clearTimeout(timeout);
    }

    const verifyOrder = async () => {
      try {
        // Dynamically build the URL based on what we have
        const queryParams = new URLSearchParams();
        if (invoiceId) queryParams.append('invoiceId', invoiceId);
        if (orderId) queryParams.append('orderId', orderId);

        const response = await fetch(`http://localhost:3000/payments/verify?${queryParams.toString()}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            console.error('Backend returned an error:', response.status);
            return; // Stay in loading and try again next interval
        }

        const data = await response.json();

        if (data.status === 'PAID') {
          setStatus('success');
        } else if (data.status === 'FAILED') {
          setStatus('error');
        }
        // If 'PENDING', the interval will fire again
      } catch (error) {
        console.error('Verification request failed', error);
      }
    };

    verifyOrder();
    const interval = setInterval(verifyOrder, 5000);
    return () => clearInterval(interval);
  }, [invoiceId, orderId, searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 py-12 px-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-6"></div>
        <h2 className="text-xl font-semibold text-gray-800">Verifying Payment...</h2>
        <p className="text-gray-500 mt-2 text-center max-w-sm">
          Please wait while we confirm your transaction. This usually takes just a few seconds.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 py-12 px-4">
        <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-red-100 mb-6">
          <svg className="h-12 w-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed or Not Found</h2>
        <p className="text-gray-600 mb-8 text-center max-w-sm">
          Unfortunately, we could not verify your payment. Please try again or check your orders page.
        </p>
        <button 
          onClick={() => router.push('/cart')}
          className="w-full max-w-xs flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          Return to Cart
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg text-center">
        <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100">
          <svg className="h-16 w-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Payment Successful!</h2>
        <p className="mt-2 text-sm text-gray-600">
          Thank you for your purchase. Your payment has been processed securely, and the seller has been notified to prepare your order.
        </p>
        <div className="mt-8 flex flex-col space-y-4">
          <Link href="/orders" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
            View My Orders
          </Link>
          <Link href="/" className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 py-12 px-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-6"></div>
        <h2 className="text-xl font-semibold text-gray-800">Loading Page...</h2>
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}