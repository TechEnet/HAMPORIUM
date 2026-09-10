import { useEffect, useState } from "react";

const FileUpload = ({
  label = "Image",
  value = "",
  file = null,
  onFileChange,
}) => {
  const [preview, setPreview] = useState(value);

  useEffect(() => {
    if (!file) {
      setPreview(value || "");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file, value]);

  const handleChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    if (selectedFile.size > 8 * 1024 * 1024) {
      alert("Image size cannot exceed 8 MB");
      event.target.value = "";
      return;
    }

    onFileChange?.(selectedFile);
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>

      {preview && (
        <div className="mb-4 h-44 w-44 overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
          <img
            src={preview}
            alt={label}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <label className="inline-flex cursor-pointer items-center rounded-lg border border-[#F97316] px-4 py-2.5 text-sm font-medium text-[#F97316] transition hover:bg-[#FFF5EC]">
        {preview ? "Choose Another Image" : "Choose Image"}

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handleChange}
          className="hidden"
        />
      </label>

      <p className="mt-2 text-xs text-gray-400">
        JPG, PNG, WEBP or AVIF. Maximum 8 MB.
      </p>
    </div>
  );
};

export default FileUpload;
