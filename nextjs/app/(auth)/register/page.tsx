import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white text-gray-900 rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-blue-600 mb-1">CommunityHQ</h1>
        <h2 className="text-xl font-semibold mb-4">Account creation is admin-managed</h2>
        <p className="text-sm text-gray-600 mb-6">
          CommunityHQ accounts are created by your HOA&apos;s administrator, since
          each account is tied to a specific community. If you need access,
          please contact your HOA management office to be added.
        </p>
        <Link href="/login" className="text-blue-600 font-medium hover:underline text-sm">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
