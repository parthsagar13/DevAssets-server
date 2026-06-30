class PaginationHelper {
  static getPagination(page = 1, limit = 10) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const offset = (pageNum - 1) * limitNum;

    return {
      page: pageNum,
      limit: limitNum,
      offset
    };
  }

  static getSort(sortBy = 'created_at', sortOrder = 'desc', allowedFields = []) {
    const field = allowedFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder?.toLowerCase() === 'asc' ? true : false;

    return {
      field,
      ascending: order
    };
  }

  static buildSearchQuery(query, searchFields) {
    if (!query) return null;

    const searchConditions = searchFields.map(field => {
      return `${field}.ilike.%${query}%`;
    });

    return `or(${searchConditions.join(',')})`;
  }

  static getPriceFilter(minPrice, maxPrice) {
    const filters = {};

    if (minPrice !== undefined && minPrice !== null) {
      filters.gte = { price: parseFloat(minPrice) };
    }

    if (maxPrice !== undefined && maxPrice !== null) {
      filters.lte = { price: parseFloat(maxPrice) };
    }

    return filters;
  }

  static getDateFilter(dateFrom, dateTo, field = 'created_at') {
    const filters = {};

    if (dateFrom) {
      filters.gte = { [field]: dateFrom };
    }

    if (dateTo) {
      filters.lte = { [field]: dateTo };
    }

    return filters;
  }
}

module.exports = PaginationHelper;
