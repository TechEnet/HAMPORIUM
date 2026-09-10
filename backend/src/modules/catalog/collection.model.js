import mongoose from "mongoose";


const collectionSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
      },

      slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },

      description: {
        type: String,
        trim: true,
        default: "",
        maxlength: 1000,
      },

      image: {
        type: String,
        trim: true,
        default: "",
      },

      bannerImage: {
        type: String,
        trim: true,
        default: "",
      },

      imagePublicId: {
  type: String,
  trim: true,
  default: "",
},

bannerImagePublicId: {
  type: String,
  trim: true,
  default: "",
},

      isFeatured: {
        type: Boolean,
        default: false,
        index: true,
      },

      isActive: {
        type: Boolean,
        default: true,
        index: true,
      },

      sortOrder: {
        type: Number,
        default: 0,
      },
    },
    {
      timestamps: true,
    }
  );


collectionSchema.index({
  isActive: 1,
  isFeatured: -1,
  sortOrder: 1,
});


const Collection =
  mongoose.model(
    "Collection",
    collectionSchema
  );


export default Collection;