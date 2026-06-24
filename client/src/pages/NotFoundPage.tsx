import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-6xl font-bold text-brand-600">404</p>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">Page not found</h1>
        <p className="mt-2 text-gray-500">Sorry, we couldn&apos;t find the page you&apos;re looking for.</p>
        <Link
          to="/"
          className="mt-6 inline-block bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
