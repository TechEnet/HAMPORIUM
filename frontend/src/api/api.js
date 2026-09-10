import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api",
  withCredentials: true,
});

export const uploadCatalogImage = async (
  file,
  type = "product"
) => {
  const formData = new FormData();

  formData.append("image", file);
  formData.append("type", type);

  const response = await api.post(
    "/catalog/admin/upload-image",
    formData
  );

  return response.data.image;
};

export const deleteCatalogImage = async (publicId) => {
  if (!publicId) return null;

  return api.delete("/catalog/admin/upload-image", {
    data: { publicId },
  });
};

export default api;
