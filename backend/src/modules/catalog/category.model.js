import mongoose from "mongoose";


const categorySchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
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
        maxlength: 500,
      },

      image: {
        type: String,
        trim: true,
        default: "",
      },

      imagePublicId: {
  type: String,
  trim: true,
  default: "",
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


categorySchema.index({
  isActive: 1,
  sortOrder: 1,
  name: 1,
});


const Category =
  mongoose.model(
    "Category",
    categorySchema
  );


export default Category;