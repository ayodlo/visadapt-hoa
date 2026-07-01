interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = 'Something went wrong. Please try again.',
  onRetry,
}: Props) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-16 text-center px-4">
      <span className="text-4xl mb-4" aria-hidden="true">⚠️</span>
      <h3 className="text-base font-semibold text-gray-900 mb-1">Unable to load</h3>
      <p className="text-sm text-gray-500 max-w-xs mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          Try again
        </button>
      )}
    </div>
  );
}
