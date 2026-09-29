import axios from 'axios';

const getBaseUrl = () => {
    let url = process.env.NEXT_PUBLIC_API_URL;

    const isRemoteBrowser = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const isProduction = process.env.NODE_ENV === 'production';

    // If url is missing or pointing to localhost while running in production or on a remote domain (Vercel)
    if (!url || ((isRemoteBrowser || isProduction) && (url.includes('localhost') || url.includes('127.0.0.1') || url.startsWith('/')))) {
        return 'https://viralis-backend-1q05.onrender.com/api';
    }

    // Ensure no trailing slash
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }

    // Check if it already has /api (avoid double /api/api)
    if (!url.endsWith('/api')) {
        url += '/api';
    }

    return url;
};

const api = axios.create({
    baseURL: getBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
