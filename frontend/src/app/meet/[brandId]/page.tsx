import VoiceInterface from '@/components/voice/VoiceInterface';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Voice Assistant | Viralis',
  description: 'Talk to our AI Agent',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0', // Crucial for mobile app feel
};

function getCleanBackendUrl() {
  let url = process.env.NEXT_PUBLIC_API_URL;
  // If not set or pointing to localhost in production/Vercel, use live Render backend
  if (!url || (process.env.NODE_ENV === 'production' && (url.includes('localhost') || url.includes('127.0.0.1')))) {
    return 'https://viralis-backend-1q05.onrender.com/api';
  }
  if (!url.endsWith('/api')) {
    url = url.replace(/\/+$/, '') + '/api';
  }
  return url;
}

// Fetch data directly in Server Component
async function getBrandData(brandId: string) {
  try {
    const baseUrl = getCleanBackendUrl();
    const apiUrl = `${baseUrl}/public/brand/${brandId}?t=${Date.now()}`;
    console.log(`📡 [Server] Fetching Brand Data from: ${apiUrl}`);

    const res = await fetch(apiUrl, {
      cache: 'no-store',
      next: { revalidate: 0 }
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`✅ [Server] Brand Data Found: ${data.name}`);
      return data;
    }
  } catch (error) {
    console.error('Error fetching brand on server:', error);
  }

  // Graceful fallback: return basic profile and let client-side fetch retry seamlessly
  return {
    _id: brandId,
    name: 'AI Voice Assistant',
    industryMode: 'Business',
    needsClientFetch: true
  };
}

export default async function MeetPage({ params }: { params: Promise<{ brandId: string }> }) {
  const resolvedParams = await params;
  const brand = await getBrandData(resolvedParams.brandId);

  return (
    <VoiceInterface brand={brand} brandId={resolvedParams.brandId} />
  );
}
