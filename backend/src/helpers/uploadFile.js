import cloudinary from "../config/storage.js";

const uploadFile = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: options.folder || "hamporium",
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(buffer);
  });
};


export const deleteFile = async (publicId) => {
  if (!publicId) {
    throw new Error("Cloudinary public ID is required");
  }

  return cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
  });
};


export default uploadFile;