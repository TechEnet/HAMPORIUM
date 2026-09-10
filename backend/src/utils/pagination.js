export const getPagination = (
  query,
  defaultLimit = 12,
  maxLimit = 100
) => {
  const requestedPage =
    Number.parseInt(query.page, 10);

  const requestedLimit =
    Number.parseInt(query.limit, 10);

  const page =
    Number.isInteger(requestedPage) &&
    requestedPage > 0
      ? requestedPage
      : 1;

  const limit =
    Number.isInteger(requestedLimit) &&
    requestedLimit > 0
      ? Math.min(
          requestedLimit,
          maxLimit
        )
      : defaultLimit;

  const skip =
    (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
};


export const getPaginationMeta = (
  total,
  page,
  limit
) => {
  const totalPages =
    total === 0
      ? 0
      : Math.ceil(
          total / limit
        );

  return {
    total,
    page,
    limit,
    totalPages,

    hasNextPage:
      page < totalPages,

    hasPreviousPage:
      page > 1,
  };
};