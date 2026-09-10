const ProductFilters = ({
  filters,
  setFilters,
  categories,
  collections,
  onApply,
  onClear,
}) => {
  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
      className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5"
    >
      <div>
        <label className="mb-2 block text-sm font-medium">Search</label>
        <input
          name="search"
          value={filters.search}
          onChange={handleChange}
          placeholder="Search gifts..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-[#F26522]"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Category</label>
        <select
          name="category"
          value={filters.category}
          onChange={handleChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-[#F26522]"
        >
          <option value="">All Categories</option>

          {categories.map((category) => (
            <option key={category._id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Collection</label>
        <select
          name="collection"
          value={filters.collection}
          onChange={handleChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-[#F26522]"
        >
          <option value="">All Collections</option>

          {collections.map((collection) => (
            <option key={collection._id} value={collection.slug}>
              {collection.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-2 block text-sm font-medium">Min ₹</label>
          <input
            type="number"
            min="0"
            name="minPrice"
            value={filters.minPrice}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-[#F26522]"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Max ₹</label>
          <input
            type="number"
            min="0"
            name="maxPrice"
            value={filters.maxPrice}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-[#F26522]"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Sort</label>

        <select
          name="sort"
          value={filters.sort}
          onChange={handleChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-[#F26522]"
        >
          <option value="">Newest</option>
          <option value="featured">Featured</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
          <option value="name">Name</option>
        </select>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="featured"
          checked={filters.featured}
          onChange={handleChange}
        />
        Featured only
      </label>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="submit"
          className="rounded-lg bg-[#F26522] px-4 py-2.5 font-medium text-white hover:bg-[#dc551b]"
        >
          Apply
        </button>

        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-gray-300 px-4 py-2.5 font-medium"
        >
          Clear
        </button>
      </div>
    </form>
  );
};

export default ProductFilters;