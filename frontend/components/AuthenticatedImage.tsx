'use client';

import { useState, useEffect, ImgHTMLAttributes } from 'react';

interface AuthenticatedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'children'> {
  src: string;
  alt: string;
}

/**
 * Image component that handles image fetching for theme files
 * If the src is an API endpoint, it fetches with authentication token (if available)
 * The route is public, so it works with or without authentication
 * Otherwise, it uses the src directly
 */
export default function AuthenticatedImage({ src, ...props }: AuthenticatedImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let blobUrl: string | null = null;
    let isMounted = true;

    // Check if it's an API endpoint
    if (src && src.includes('/api/theme/files/')) {
      const fetchImage = async () => {
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
          
          // Build headers - include token if available, but route is public so it's optional
          const headers: HeadersInit = {};
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const response = await fetch(src, {
            headers,
          });

          if (!response.ok) {
            if (isMounted) {
              setError(true);
            }
            return;
          }

          const blob = await response.blob();
          blobUrl = URL.createObjectURL(blob);
          
          if (isMounted) {
            setImageSrc(blobUrl);
          } else {
            // Component unmounted before image loaded, cleanup immediately
            URL.revokeObjectURL(blobUrl);
          }
        } catch (err) {
          console.error('Failed to fetch authenticated image:', err);
          if (isMounted) {
            setError(true);
          }
        }
      };

      fetchImage();
    } else {
      // Public URL, use directly
      setImageSrc(src);
    }

    // Cleanup function
    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [src]);

  if (error || !imageSrc) {
    return null; // Or return a placeholder image
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imageSrc} {...props} />;
}

