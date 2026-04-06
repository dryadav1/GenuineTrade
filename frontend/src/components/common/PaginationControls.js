export default function PaginationControls({ pagination, onPageChange }) {
  if (!pagination) {
    return null;
  }

  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <p className="text-sm text-muted">
        Page {pagination.page} of {pagination.totalPages} | {pagination.total} total
      </p>
      <div className="flex gap-3">
        <button
          className="btn-secondary px-4 py-2"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
          type="button"
        >
          Previous
        </button>
        <button
          className="btn-secondary px-4 py-2"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}
