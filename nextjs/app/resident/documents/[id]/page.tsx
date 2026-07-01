import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { categoryLabel } from '@/lib/documents';

export default async function ResidentDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { uploadedBy: { select: { firstName: true, lastName: true } } },
  });

  if (!doc) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/resident/documents"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
      >
        ← Back to Documents
      </Link>

      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-wrap items-start gap-3 mb-4">
          <span className="text-3xl" aria-hidden="true">📄</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 mb-1">{doc.title}</h1>
            <StatusBadge status={doc.category} />
          </div>
        </div>

        {doc.description && (
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">{doc.description}</p>
        )}

        <div className="border-t border-gray-100 pt-5 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 w-28">Category</span>
            <span className="text-sm text-gray-900">{categoryLabel(doc.category)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 w-28">File name</span>
            <span className="text-sm text-gray-900 font-mono">{doc.fileName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 w-28">Uploaded by</span>
            <span className="text-sm text-gray-900">
              {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 w-28">Upload date</span>
            <span className="text-sm text-gray-900">
              {new Date(doc.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-gray-100">
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Download file
          </a>
        </div>
      </div>
    </div>
  );
}
