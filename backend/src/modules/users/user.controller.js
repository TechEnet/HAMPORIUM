import mongoose from "mongoose";

import User from "./user.model.js";
import Address from "./address.model.js";

import asyncHandler from "../../utils/asyncHandler.js";


const publicUser = (user) => ({
  id: user._id,

  name: user.name,

  email: user.email,

  phone: user.phone,

  avatar:
    user.avatar || "",

  roles: user.roles,

  isActive:
    user.isActive,

  createdAt:
    user.createdAt,

  updatedAt:
    user.updatedAt,
});


const validAddressId = (id) => {
  return mongoose.isValidObjectId(id);
};


export const getMyProfile = asyncHandler(
  async (req, res) => {
    res.status(200).json({
      success: true,
      user: publicUser(req.user),
    });
  }
);


export const updateMyProfile = asyncHandler(
  async (req, res) => {
    const allowedFields = [
      "name",
      "phone",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        req.user[field] = req.body[field];
      }
    });

    await req.user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: publicUser(req.user),
    });
  }
);


export const getMyAddresses = asyncHandler(
  async (req, res) => {
    const addresses = await Address.find({
      user: req.user._id,
    }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      addresses,
    });
  }
);


export const createAddress = asyncHandler(
  async (req, res) => {
    const {
      label,
      fullName,
      phone,
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      postalCode,
      country,
      isDefault,
    } = req.body;

    if (
      !fullName ||
      !phone ||
      !addressLine1 ||
      !city ||
      !state ||
      !postalCode
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Full name, phone, address, city, state and postal code are required",
      });
    }

    const addressCount =
      await Address.countDocuments({
        user: req.user._id,
      });

    const shouldBeDefault =
      addressCount === 0 || isDefault === true;

    if (shouldBeDefault) {
      await Address.updateMany(
        {
          user: req.user._id,
        },
        {
          $set: {
            isDefault: false,
          },
        }
      );
    }

    const address = await Address.create({
      user: req.user._id,
      label,
      fullName,
      phone,
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      postalCode,
      country,
      isDefault: shouldBeDefault,
    });

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      address,
    });
  }
);


export const updateAddress = asyncHandler(
  async (req, res) => {
    const { addressId } = req.params;

    if (!validAddressId(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    const address = await Address.findOne({
      _id: addressId,
      user: req.user._id,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const allowedFields = [
      "label",
      "fullName",
      "phone",
      "addressLine1",
      "addressLine2",
      "landmark",
      "city",
      "state",
      "postalCode",
      "country",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        address[field] = req.body[field];
      }
    });

    if (req.body.isDefault === true) {
      await Address.updateMany(
        {
          user: req.user._id,
          _id: {
            $ne: address._id,
          },
        },
        {
          $set: {
            isDefault: false,
          },
        }
      );

      address.isDefault = true;
    }

    await address.save();

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      address,
    });
  }
);


export const deleteAddress = asyncHandler(
  async (req, res) => {
    const { addressId } = req.params;

    if (!validAddressId(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    const address = await Address.findOne({
      _id: addressId,
      user: req.user._id,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const wasDefault = address.isDefault;

    await address.deleteOne();

    if (wasDefault) {
      const nextAddress = await Address.findOne({
        user: req.user._id,
      }).sort({
        createdAt: 1,
      });

      if (nextAddress) {
        nextAddress.isDefault = true;

        await nextAddress.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  }
);