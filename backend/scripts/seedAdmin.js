import "dotenv/config";

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import connectDB from "../src/config/db.js";

import User from "../src/modules/users/user.model.js";

import { ROLES } from "../src/constants/roles.js";


const seedAdmin = async () => {
  try {
    const {
      ADMIN_NAME,
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
    } = process.env;


    if (
      !ADMIN_NAME ||
      !ADMIN_EMAIL ||
      !ADMIN_PASSWORD
    ) {
      throw new Error(
        "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD are required"
      );
    }


    await connectDB();


    const hashedPassword =
      await bcrypt.hash(
        ADMIN_PASSWORD,
        12
      );


    let admin = await User.findOne({
      email: ADMIN_EMAIL.toLowerCase(),
    }).select("+password");


    if (!admin) {
      admin = await User.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL.toLowerCase(),
        password: hashedPassword,
        roles: [
          ROLES.CUSTOMER,
          ROLES.ADMIN,
          ROLES.OPERATIONS,
        ],
      });

      console.log(
        `Admin created: ${admin.email}`
      );
    } else {
      admin.name = ADMIN_NAME;
      admin.password = hashedPassword;
      admin.isActive = true;

      const requiredRoles = [
        ROLES.CUSTOMER,
        ROLES.ADMIN,
        ROLES.OPERATIONS,
      ];

      requiredRoles.forEach((role) => {
        if (!admin.roles.includes(role)) {
          admin.roles.push(role);
        }
      });

      await admin.save();

      console.log(
        `Admin updated: ${admin.email}`
      );
    }


    await mongoose.connection.close();

    process.exit(0);
  } catch (error) {
    console.error(
      "Admin seed failed:",
      error.message
    );

    await mongoose.connection.close();

    process.exit(1);
  }
};


seedAdmin();