export const parsePagination = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(query.limit || "10", 10) || 10)
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
};

export const createPaginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit))
});
