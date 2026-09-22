import mongoose from "mongoose";



import Review from "./review.model.js";

import Order from "../orders/order.model.js";

import Product from "../catalog/product.model.js";



import asyncHandler from "../../utils/asyncHandler.js";

import createAuditLog from "../../helpers/createAuditLog.js";

import { ORDER_STATUS } from "../../constants/statuses.js";



const isValidId = (value) =>

  mongoose.isValidObjectId(value);



const clean = (

  value,

  maxLength

) =>

  String(value || "")

    .trim()

    .replace(/\s+/g, " ")

    .slice(0, maxLength);



const parseRating = (value) => {

  const rating =

    Number(value);



  return Number.isInteger(

    rating

  ) &&

    rating >= 1 &&

    rating <= 5

    ? rating

    : null;

};



const pagination = (

  req,

  defaultLimit = 12

) => {

  const page =

    Math.max(

      Number(req.query.page) || 1,

      1

    );



  const limit =

    Math.min(

      Math.max(

        Number(req.query.limit) ||

          defaultLimit,

        1

      ),

      100

    );



  return {

    page,

    limit,

    skip:

      (page - 1) *

      limit,

  };

};



const isCustomHamperLine = (

  item

) => {

  if (!item) {

    return false;

  }



  if (

    item.itemType ===

    "custom_hamper"

  ) {

    return true;

  }



  if (item.customHamper) {

    return true;

  }



  if (

    String(

      item.skuCode || ""

    )

      .trim()

      .toUpperCase() ===

    "CUSTOM-HAMPER"

  ) {

    return true;

  }



  const productName =

    String(

      item.productName ||

        ""

    ).toLowerCase();



  const skuName =

    String(

      item.skuName || ""

    ).toLowerCase();



  return (

    productName.includes(

      "custom hamper"

    ) ||

    skuName.includes(

      "custom hamper"

    )

  );

};



const getCustomHamperName = (

  line

) =>

  line?.customHamper

    ?.containerName ||

  line?.skuName ||

  line?.productName ||

  "Custom Hamper";



const clearHomepageFeature = (review) => {
  review.homepageFeatured = false;
  review.homepagePosition = null;
  review.homepageFeaturedAt = null;
  review.homepageFeaturedBy = null;
};

const normalizeHomepagePositions = async () => {
  const rows = await Review.find({
    status: "published",
    homepageFeatured: true,
  })
    .sort({ homepagePosition: 1, homepageFeaturedAt: 1, createdAt: 1 })
    .select("_id")
    .lean();

  if (!rows.length) return;

  await Review.bulkWrite(
    rows.map((row, index) => ({
      updateOne: {
        filter: { _id: row._id },
        update:
          index < 6
            ? {
                $set: {
                  homepageFeatured: true,
                  homepagePosition: index + 1,
                },
              }
            : {
                $set: { homepageFeatured: false },
                $unset: {
                  homepagePosition: 1,
                  homepageFeaturedAt: 1,
                  homepageFeaturedBy: 1,
                },
              },
      },
    }))
  );
};

const setHomepageReview = async ({ review, featured, position, adminId }) => {
  if (!featured) {
    clearHomepageFeature(review);
    await review.save();
    await normalizeHomepagePositions();
    return Review.findById(review._id);
  }

  if (review.status !== "published") {
    const error = new Error("Only published reviews can be shown on the homepage.");
    error.statusCode = 400;
    throw error;
  }

  const others = await Review.find({
    _id: { $ne: review._id },
    status: "published",
    homepageFeatured: true,
  })
    .sort({ homepagePosition: 1, homepageFeaturedAt: 1, createdAt: 1 })
    .select("_id")
    .lean();

  if (!review.homepageFeatured && others.length >= 6) {
    const error = new Error(
      "The homepage can feature up to 6 reviews. Remove one before adding another."
    );
    error.statusCode = 400;
    throw error;
  }

  const ids = others.map((row) => String(row._id));
  const requested = Number.isInteger(position)
    ? Math.min(6, Math.max(1, position))
    : ids.length + 1;

  ids.splice(Math.min(requested - 1, ids.length), 0, String(review._id));

  const now = new Date();
  await Review.bulkWrite(
    ids.slice(0, 6).map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update:
          id === String(review._id)
            ? {
                $set: {
                  homepageFeatured: true,
                  homepagePosition: index + 1,
                  homepageFeaturedAt: review.homepageFeaturedAt || now,
                  homepageFeaturedBy: adminId,
                },
              }
            : {
                $set: {
                  homepageFeatured: true,
                  homepagePosition: index + 1,
                },
              },
      },
    }))
  );

  return Review.findById(review._id);
};



const getProductSummary =

  async (productId) => {

    const objectId =

      new mongoose.Types.ObjectId(

        productId

      );



    const [

      totals,

      distributionRows,

    ] =

      await Promise.all([

        Review.aggregate([

          {

            $match: {

              targetType:

                "product",

              product:

                objectId,

              status:

                "published",

            },

          },

          {

            $group: {

              _id: null,

              averageRating: {

                $avg:

                  "$rating",

              },

              totalReviews: {

                $sum: 1,

              },

            },

          },

        ]),



        Review.aggregate([

          {

            $match: {

              targetType:

                "product",

              product:

                objectId,

              status:

                "published",

            },

          },

          {

            $group: {

              _id:

                "$rating",

              count: {

                $sum: 1,

              },

            },

          },

        ]),

      ]);



    const distribution = {

      1: 0,

      2: 0,

      3: 0,

      4: 0,

      5: 0,

    };



    for (

      const row of

      distributionRows

    ) {

      distribution[

        row._id

      ] = row.count;

    }



    return {

      averageRating:

        Number(

          Number(

            totals[0]

              ?.averageRating ||

              0

          ).toFixed(1)

        ),



      totalReviews:

        Number(

          totals[0]

            ?.totalReviews ||

            0

        ),



      distribution,

    };

  };



const findDeliveredProductPurchase =

  async ({

    userId,

    productId,

    orderId = null,

  }) => {

    const filter = {

      user: userId,

      status:

        ORDER_STATUS.DELIVERED,

      "items.product":

        productId,

    };



    if (orderId) {

      if (

        !isValidId(

          orderId

        )

      ) {

        return null;

      }



      filter._id =

        orderId;

    }



    const order =

      await Order.findOne(

        filter

      )

        .sort({

          createdAt: -1,

        })

        .lean();



    if (!order) {

      return null;

    }



    const line =

      (

        order.items || []

      ).find(

        (item) =>

          String(

            item.product ||

              ""

          ) ===

          String(productId)

      );



    if (!line) {

      return null;

    }



    return {

      order,

      line,

    };

  };



const findDeliveredCustomHamperPurchase =

  async ({

    userId,

    orderId,

  }) => {

    if (

      !isValidId(

        orderId

      )

    ) {

      return null;

    }



    const order =

      await Order.findOne({

        _id: orderId,

        user: userId,

        status:

          ORDER_STATUS.DELIVERED,

      }).lean();



    if (!order) {

      return null;

    }



    const line =

      (

        order.items || []

      ).find(

        isCustomHamperLine

      );



    if (!line) {

      return null;

    }



    return {

      order,

      line,

    };

  };



/* =========================================================

   PUBLIC HOMEPAGE REVIEWS

========================================================= */

export const getHomepageReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({
    status: "published",
    homepageFeatured: true,
  })
    .populate("user", "name")
    .populate("product", "name slug")
    .sort({ homepagePosition: 1, homepageFeaturedAt: 1, createdAt: -1 })
    .limit(6)
    .select(
      "user targetType targetName product rating title comment verifiedPurchase homepagePosition createdAt"
    )
    .lean();

  res.json({ success: true, reviews });
});



/* =========================================================

   PUBLIC PRODUCT REVIEWS

========================================================= */



export const getProductReviews =

  asyncHandler(

    async (

      req,

      res

    ) => {

      const {

        productId,

      } = req.params;



      if (

        !isValidId(

          productId

        )

      ) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Invalid product ID",

          });

      }



      const {

        page,

        limit,

        skip,

      } =

        pagination(req);



      const filter = {

        targetType:

          "product",

        product:

          productId,

        status:

          "published",

      };



      const [

        reviews,

        total,

        summary,

      ] =

        await Promise.all([

          Review.find(

            filter

          )

            .populate(

              "user",

              "name"

            )

            .sort({

              createdAt: -1,

            })

            .skip(skip)

            .limit(limit)

            .select(

              "user targetType targetName product sku rating title comment verifiedPurchase createdAt updatedAt"

            )

            .lean(),



          Review.countDocuments(

            filter

          ),



          getProductSummary(

            productId

          ),

        ]);



      res.json({

        success: true,

        reviews,

        summary,

        pagination: {

          page,

          limit,

          total,

          pages:

            Math.ceil(

              total /

                limit

            ),

        },

      });

    }

  );



/* =========================================================

   ELIGIBILITY

========================================================= */



export const getReviewEligibility =

  asyncHandler(

    async (

      req,

      res

    ) => {

      const {

        productId,

      } = req.params;



      if (

        !isValidId(

          productId

        )

      ) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Invalid product ID",

          });

      }



      const [

        purchase,

        existingReview,

      ] =

        await Promise.all([

          findDeliveredProductPurchase(

            {

              userId:

                req.user._id,

              productId,

            }

          ),



          Review.findOne({

            user:

              req.user._id,

            targetType:

              "product",

            product:

              productId,

          }).lean(),

        ]);



      res.json({

        success: true,

        eligibility: {

          eligible:

            Boolean(

              purchase

            ),



          reason:

            purchase

              ? "DELIVERED_VERIFIED_PURCHASE"

              : "NO_DELIVERED_PURCHASE",



          orderId:

            purchase?.order

              ?._id ||

            null,



          existingReview:

            existingReview ||

            null,

        },

      });

    }

  );



export const getCustomHamperReviewEligibility =

  asyncHandler(

    async (

      req,

      res

    ) => {

      const {

        orderId,

      } = req.params;



      if (

        !isValidId(

          orderId

        )

      ) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Invalid order ID",

          });

      }



      const [

        purchase,

        existingReview,

      ] =

        await Promise.all([

          findDeliveredCustomHamperPurchase(

            {

              userId:

                req.user._id,

              orderId,

            }

          ),



          Review.findOne({

            user:

              req.user._id,

            targetType:

              "custom_hamper",

            order:

              orderId,

          }).lean(),

        ]);



      res.json({

        success: true,

        eligibility: {

          eligible:

            Boolean(

              purchase

            ),



          reason:

            purchase

              ? "DELIVERED_VERIFIED_CUSTOM_HAMPER"

              : "NO_DELIVERED_CUSTOM_HAMPER",



          orderId:

            purchase?.order

              ?._id ||

            null,



          targetName:

            purchase

              ? getCustomHamperName(

                  purchase.line

                )

              : "",



          existingReview:

            existingReview ||

            null,

        },

      });

    }

  );



/* =========================================================

   CREATE / UPDATE

========================================================= */



export const createOrUpdateReview =

  asyncHandler(

    async (

      req,

      res

    ) => {

      const targetType =

        clean(

          req.body

            ?.targetType ||

            "product",

          30

        ).toLowerCase();



      const rating =

        parseRating(

          req.body?.rating

        );



      const title =

        clean(

          req.body?.title,

          120

        );



      const comment =

        clean(

          req.body

            ?.comment,

          2000

        );



      if (

        ![

          "product",

          "custom_hamper",

        ].includes(

          targetType

        )

      ) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Invalid review target",

          });

      }



      if (!rating) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Rating must be a whole number from 1 to 5",

          });

      }



      if (

        comment.length <

        3

      ) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Review must be at least 3 characters",

          });

      }



      /* -------------------------------------------------

         CUSTOM HAMPER

      ------------------------------------------------- */



      if (

        targetType ===

        "custom_hamper"

      ) {

        const orderId =

          req.body?.orderId;



        if (

          !isValidId(

            orderId

          )

        ) {

          return res

            .status(400)

            .json({

              success: false,

              message:

                "Valid order ID is required",

            });

        }



        const purchase =

          await findDeliveredCustomHamperPurchase(

            {

              userId:

                req.user._id,

              orderId,

            }

          );



        if (!purchase) {

          return res

            .status(403)

            .json({

              success: false,

              message:

                "You can review this custom hamper only after the order is delivered.",

            });

        }



        let review =

          await Review.findOne({

            user:

              req.user._id,

            targetType:

              "custom_hamper",

            order:

              purchase.order

                ._id,

          });



        const isNew =

          !review;



        if (!review) {

          review =

            new Review({

              user:

                req.user._id,

              order:

                purchase.order

                  ._id,

              targetType:

                "custom_hamper",

              product:

                null,

              orderItemId:

                purchase.line

                  ?._id ||

                null,

              targetName:

                getCustomHamperName(

                  purchase.line

                ),

              sku: null,

              verifiedPurchase:

                true,

              status:

                "published",

            });

        }



        review.order =

          purchase.order._id;



        review.orderItemId =

          purchase.line

            ?._id ||

          review.orderItemId ||

          null;



        review.targetName =

          getCustomHamperName(

            purchase.line

          );



        review.rating =

          rating;



        review.title =

          title;



        review.comment =

          comment;



        await review.save();



        return res

          .status(

            isNew

              ? 201

              : 200

          )

          .json({

            success: true,

            message:

              isNew

                ? "Review published"

                : "Review updated",

            review,

          });

      }



      /* -------------------------------------------------

         STANDARD PRODUCT

      ------------------------------------------------- */



      const productId =

        req.body?.productId;



      const orderId =

        req.body?.orderId ||

        null;



      if (

        !isValidId(

          productId

        )

      ) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Valid product ID is required",

          });

      }



      const product =

        await Product.findById(

          productId

        )

          .select(

            "_id name"

          )

          .lean();



      if (!product) {

        return res

          .status(404)

          .json({

            success: false,

            message:

              "Product not found",

          });

      }



      const purchase =

        await findDeliveredProductPurchase(

          {

            userId:

              req.user._id,

            productId,

            orderId,

          }

        );



      if (!purchase) {

        return res

          .status(403)

          .json({

            success: false,

            message:

              "You can review this product only after your purchased order is delivered.",

          });

      }



      let review =

        await Review.findOne({

          user:

            req.user._id,

          targetType:

            "product",

          product:

            productId,

        });



      const isNew =

        !review;



      if (!review) {

        review =

          new Review({

            user:

              req.user._id,

            order:

              purchase.order

                ._id,

            targetType:

              "product",

            product:

              productId,

            orderItemId:

              purchase.line

                ?._id ||

              null,

            targetName:

              product.name ||

              "",

            sku:

              purchase.line

                .sku ||

              null,

            verifiedPurchase:

              true,

            status:

              "published",

          });

      }



      review.order =

        purchase.order._id;



      review.orderItemId =

        purchase.line

          ?._id ||

        review.orderItemId ||

        null;



      review.targetName =

        product.name ||

        review.targetName ||

        "";



      review.sku =

        purchase.line

          .sku ||

        review.sku ||

        null;



      review.rating =

        rating;



      review.title =

        title;



      review.comment =

        comment;



      await review.save();



      return res

        .status(

          isNew

            ? 201

            : 200

        )

        .json({

          success: true,

          message:

            isNew

              ? "Review published"

              : "Review updated",

          review,

        });

    }

  );



/* =========================================================

   USER REVIEW MANAGEMENT

========================================================= */



export const updateMyReview =

  asyncHandler(

    async (

      req,

      res

    ) => {

      const {

        reviewId,

      } = req.params;



      if (

        !isValidId(

          reviewId

        )

      ) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Invalid review ID",

          });

      }



      const review =

        await Review.findOne({

          _id: reviewId,

          user:

            req.user._id,

        });



      if (!review) {

        return res

          .status(404)

          .json({

            success: false,

            message:

              "Review not found",

          });

      }



      if (

        req.body.rating !==

        undefined

      ) {

        const rating =

          parseRating(

            req.body.rating

          );



        if (!rating) {

          return res

            .status(400)

            .json({

              success: false,

              message:

                "Rating must be from 1 to 5",

            });

        }



        review.rating =

          rating;

      }



      if (

        req.body.title !==

        undefined

      ) {

        review.title =

          clean(

            req.body.title,

            120

          );

      }



      if (

        req.body.comment !==

        undefined

      ) {

        const comment =

          clean(

            req.body.comment,

            2000

          );



        if (

          comment.length <

          3

        ) {

          return res

            .status(400)

            .json({

              success: false,

              message:

                "Review must be at least 3 characters",

            });

        }



        review.comment =

          comment;

      }



      await review.save();



      res.json({

        success: true,

        message:

          "Review updated",

        review,

      });

    }

  );



export const deleteMyReview =

  asyncHandler(

    async (

      req,

      res

    ) => {

      if (

        !isValidId(

          req.params.reviewId

        )

      ) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Invalid review ID",

          });

      }



      const review =

        await Review.findOneAndDelete({

          _id:

            req.params

              .reviewId,

          user:

            req.user._id,

        });



      if (!review) {

        return res

          .status(404)

          .json({

            success: false,

            message:

              "Review not found",

          });

      }



      res.json({

        success: true,

        message:

          "Review deleted",

      });

    }

  );



export const getMyReviews =

  asyncHandler(

    async (

      req,

      res

    ) => {

      const {

        page,

        limit,

        skip,

      } =

        pagination(

          req,

          20

        );



      const filter = {

        user:

          req.user._id,

      };



      const [

        reviews,

        total,

      ] =

        await Promise.all([

          Review.find(

            filter

          )

            .populate(

              "product",

              "name slug images"

            )

            .populate(

              "order",

              "orderNumber status deliveredAt"

            )

            .sort({

              updatedAt: -1,

            })

            .skip(skip)

            .limit(limit)

            .lean(),



          Review.countDocuments(

            filter

          ),

        ]);



      res.json({

        success: true,

        reviews,

        pagination: {

          page,

          limit,

          total,

          pages:

            Math.ceil(

              total /

                limit

            ),

        },

      });

    }

  );



/* =========================================================

   ADMIN

========================================================= */



export const getAdminReviews =

  asyncHandler(

    async (

      req,

      res

    ) => {

      const {

        page,

        limit,

        skip,

      } =

        pagination(

          req,

          30

        );



      const filter = {};



      if (

        req.query.status

      ) {

        if (

          ![

            "published",

            "hidden",

          ].includes(

            req.query.status

          )

        ) {

          return res

            .status(400)

            .json({

              success: false,

              message:

                "Invalid review status",

            });

        }



        filter.status =

          req.query.status;

      }



      if (req.query.homepageFeatured !== undefined) {
        const value = String(req.query.homepageFeatured);

        if (!["true", "false"].includes(value)) {
          return res.status(400).json({
            success: false,
            message: "homepageFeatured must be true or false",
          });
        }

        filter.homepageFeatured = value === "true";
      }



      if (

        req.query.product &&

        isValidId(

          req.query.product

        )

      ) {

        filter.targetType =

          "product";



        filter.product =

          req.query.product;

      }



      const [

        reviews,

        total,

      ] =

        await Promise.all([

          Review.find(

            filter

          )

            .populate(

              "user",

              "name email"

            )

            .populate(

              "product",

              "name slug"

            )

            .populate(

              "order",

              "orderNumber status"

            )

            .populate(

              "moderation.reviewedBy",

              "name email"

            )

            .populate(

              "homepageFeaturedBy",

              "name email"

            )

            .sort(
              filter.homepageFeatured === true
                ? { homepagePosition: 1, createdAt: -1 }
                : { createdAt: -1 }
            )

            .skip(skip)

            .limit(limit)

            .lean(),



          Review.countDocuments(

            filter

          ),

        ]);



      res.json({

        success: true,

        reviews,

        pagination: {

          page,

          limit,

          total,

          pages:

            Math.ceil(

              total /

                limit

            ),

        },

      });

    }

  );



export const setHomepageFeatured = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  if (!isValidId(reviewId)) {
    return res.status(400).json({ success: false, message: "Invalid review ID" });
  }

  if (typeof req.body?.featured !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "featured must be true or false",
    });
  }

  let position = null;
  if (req.body?.position !== undefined && req.body?.position !== null && req.body?.position !== "") {
    position = Number(req.body.position);
    if (!Number.isInteger(position) || position < 1 || position > 6) {
      return res.status(400).json({
        success: false,
        message: "Homepage position must be a whole number from 1 to 6",
      });
    }
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    return res.status(404).json({ success: false, message: "Review not found" });
  }

  const previous = {
    featured: Boolean(review.homepageFeatured),
    position: review.homepagePosition || null,
  };

  let updated;
  try {
    updated = await setHomepageReview({
      review,
      featured: req.body.featured,
      position,
      adminId: req.user._id,
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }

  await createAuditLog({
    req,
    action: "review_homepage_feature_updated",
    module: "reviews",
    entityType: "review",
    entityId: review._id,
    description: updated?.homepageFeatured
      ? `Review featured on homepage at position ${updated.homepagePosition}.`
      : "Review removed from homepage.",
    changes: {
      homepageFeatured: {
        from: previous.featured,
        to: Boolean(updated?.homepageFeatured),
      },
      homepagePosition: {
        from: previous.position,
        to: updated?.homepagePosition || null,
      },
    },
  });

  const responseReview = await Review.findById(reviewId)
    .populate("user", "name email")
    .populate("product", "name slug")
    .populate("order", "orderNumber status")
    .populate("homepageFeaturedBy", "name email")
    .lean();

  res.json({
    success: true,
    message: responseReview?.homepageFeatured
      ? "Review added to homepage"
      : "Review removed from homepage",
    review: responseReview,
  });
});



export const moderateReview =

  asyncHandler(

    async (

      req,

      res

    ) => {

      if (

        !isValidId(

          req.params.reviewId

        )

      ) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Invalid review ID",

          });

      }



      const status =

        clean(

          req.body?.status,

          30

        ).toLowerCase();



      if (

        ![

          "published",

          "hidden",

        ].includes(

          status

        )

      ) {

        return res

          .status(400)

          .json({

            success: false,

            message:

              "Status must be published or hidden",

          });

      }



      const review =

        await Review.findById(

          req.params

            .reviewId

        );



      if (!review) {

        return res

          .status(404)

          .json({

            success: false,

            message:

              "Review not found",

          });

      }



      const previous =

        review.status;



      const wasHomepageFeatured = Boolean(review.homepageFeatured);

      review.status =

        status;

      if (status !== "published") {
        clearHomepageFeature(review);
      }



      review.moderation = {

        note:

          clean(

            req.body?.note,

            1000

          ),

        reviewedBy:

          req.user._id,

        reviewedAt:

          new Date(),

      };



      await review.save();

      if (wasHomepageFeatured && status !== "published") {
        await normalizeHomepagePositions();
      }



      await createAuditLog({

        req,

        action:

          "review_moderated",

        module:

          "reviews",

        entityType:

          "review",

        entityId:

          review._id,

        description:

          `Review moderation changed from ${previous} to ${status}.`,

        changes: {

          status: {

            from:

              previous,

            to:

              status,

          },

        },

      });



      res.json({

        success: true,

        message:

          "Review moderation updated",

        review,

      });

    }

  );
