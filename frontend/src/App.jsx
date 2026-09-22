import { useLayoutEffect } from "react";

import {

  Navigate,

  Route,

  Routes,

  useLocation,

} from "react-router-dom";



import PublicLayout from "./layouts/PublicLayout.jsx";

import AccountLayout from "./layouts/AccountLayout.jsx";

import AdminLayout from "./layouts/AdminLayout.jsx";

import PartnerLayout from "./layouts/PartnerLayout.jsx";

import ShowcaseLayout from "./layouts/ShowcaseLayout.jsx";



import ProtectedRoute from "./components/ProtectedRoute.jsx";

import PartnerRoute from "./components/PartnerRoute.jsx";

import PartnerReferralCapture from "./components/PartnerReferralCapture.jsx";



import { LocationProvider } from "./context/LocationContext.jsx";

import { PartnerProvider } from "./context/PartnerContext.jsx";



// Public

import Home from "./pages/public/Home.jsx";

import Gifts from "./pages/public/Gifts.jsx";

import Collection from "./pages/public/Collection.jsx";

import ProductDetails from "./pages/public/ProductDetails.jsx";

import CustomHamper from "./pages/public/CustomHamper.jsx";

import HamperOne from "./pages/public/HamperOne.jsx";

import EventPartners from "./pages/public/EventPartners.jsx";

import Cart from "./pages/public/Cart.jsx";

import Checkout from "./pages/public/Checkout.jsx";

import OrderSuccess from "./pages/public/OrderSuccess.jsx";



// Customer auth

import Login from "./pages/auth/Login.jsx";

import Signup from "./pages/auth/Signup.jsx";

import VerifyEmail from "./pages/auth/VerifyEmail.jsx";

import ForgotPassword from "./pages/auth/ForgotPassword.jsx";

import VerifyOTP from "./pages/auth/VerifyOTP.jsx";



// Partner auth / portal

import PartnerLogin from "./pages/partner/Login.jsx";

import PartnerRegister from "./pages/partner/Register.jsx";

import PartnerApplicationStatus from "./pages/partner/ApplicationStatus.jsx";

import PartnerDashboard from "./pages/partner/Dashboard.jsx";

import PartnerProjects from "./pages/partner/Projects.jsx";

import PartnerProjectDetails from "./pages/partner/ProjectDetails.jsx";

import PartnerShowcases from "./pages/partner/Showcases.jsx";

import PartnerClientActions from "./pages/partner/ClientActions.jsx";

import PartnerOrders from "./pages/partner/Orders.jsx";

import PartnerCommissions from "./pages/partner/Commissions.jsx";

import PartnerPayouts from "./pages/partner/Payouts.jsx";

import PartnerAnalytics from "./pages/partner/Analytics.jsx";

import PartnerDocuments from "./pages/partner/Documents.jsx";

import PartnerProfile from "./pages/partner/Profile.jsx";



// Account

import AccountDashboard from "./pages/account/Dashboard.jsx";

import Profile from "./pages/account/Profile.jsx";

import Addresses from "./pages/account/Addresses.jsx";

import Orders from "./pages/account/Orders.jsx";

import OrderDetails from "./pages/account/OrderDetails.jsx";

import Payments from "./pages/account/Payments.jsx";

import PaymentDetails from "./pages/account/PaymentDetails.jsx";

import Refunds from "./pages/account/Refunds.jsx";

import MyReviews from "./pages/account/MyReviews.jsx";

import Support from "./pages/account/support/Support.jsx";

import SupportTicketDetails from "./pages/account/support/SupportTicketDetails.jsx";



// Unified customer RFQ / quotation UI

import AccountRFQs from "./pages/account/corporate/RFQs.jsx";

import AccountRFQDetails from "./pages/account/corporate/RFQDetails.jsx";

import AccountQuotes from "./pages/account/corporate/Quotes.jsx";

import AccountQuoteDetails from "./pages/account/corporate/QuoteDetails.jsx";



// Admin

import AdminDashboard from "./pages/admin/Dashboard.jsx";

import Products from "./pages/admin/catalog/Products.jsx";

import ProductForm from "./pages/admin/catalog/ProductForm.jsx";

import Categories from "./pages/admin/catalog/Categories.jsx";

import Collections from "./pages/admin/catalog/Collections.jsx";

import Components from "./pages/admin/catalog/Components.jsx";

import Containers from "./pages/admin/catalog/Containers.jsx";

import ProductMasterImport from "./pages/admin/catalog/ProductMasterImport.jsx";

import AdminMasterControl from "./pages/admin/MasterControl.jsx";

import AdminOrders from "./pages/admin/orders/Orders.jsx";

import AdminOrderDetails from "./pages/admin/orders/OrderDetails.jsx";

import AdminPayments from "./pages/admin/payments/Payments.jsx";

import AdminPaymentDetails from "./pages/admin/payments/PaymentDetails.jsx";

import AdminRFQs from "./pages/admin/rfq/RFQs.jsx";

import AdminRFQDetails from "./pages/admin/rfq/RFQDetails.jsx";

import AdminQuotes from "./pages/admin/quotes/Quotes.jsx";

import AdminQuoteDetails from "./pages/admin/quotes/QuoteDetails.jsx";

import AdminApprovals from "./pages/admin/Approvals.jsx";

import AdminCorporate from "./pages/admin/corporate/Corporate.jsx";

import AdminCorporateDetails from "./pages/admin/corporate/CorporateDetails.jsx";

import AdminWeddings from "./pages/admin/weddings/Weddings.jsx";

import AdminWeddingDetails from "./pages/admin/weddings/WeddingDetails.jsx";

import AdminSearchAnalytics from "./pages/admin/analytics/SearchAnalytics.jsx";

import AdminPartners from "./pages/admin/partners/Partners.jsx";

import AdminPartnerDetails from "./pages/admin/partners/PartnerDetails.jsx";

import AdminProduction from "./pages/admin/Production.jsx";

import AdminFulfilment from "./pages/admin/Fulfilment.jsx";


import AdminCommissions from "./pages/admin/Commissions.jsx";

import AdminPayouts from "./pages/admin/Payouts.jsx";

import AdminPartnerShowcases from "./pages/admin/PartnerShowcases.jsx";

import AdminRefunds from "./pages/admin/Refunds.jsx";

import AdminReviews from "./pages/admin/Reviews.jsx";

import AdminSupportTickets from "./pages/admin/support/SupportTickets.jsx";

import AdminSupportTicketDetails from "./pages/admin/support/SupportTicketDetails.jsx";



// Secure public showcase

import ShowcaseAccess from "./pages/showcase/ShowcaseAccess.jsx";

import ShowcaseView from "./pages/showcase/ShowcaseView.jsx";



// ======================================================

// UNIVERSAL ROUTE SCROLL RESET

// Robust version:

// - window/document scroll

// - #root

// - nested overflow-y auto/scroll containers used by layouts

// - runs immediately + next frames so browser restoration/layout

//   cannot put the new route back in the previous scroll position

// ======================================================



const ScrollToTop = () => {

  const location = useLocation();



  useLayoutEffect(() => {

    if (

      "scrollRestoration" in

      window.history

    ) {

      window.history.scrollRestoration =

        "manual";

    }

  }, []);



  useLayoutEffect(() => {

    let raf1 = 0;

    let raf2 = 0;

    let timeoutId = 0;



    const resetScroll = () => {

      const html =

        document.documentElement;



      const body =

        document.body;



      const scrollingElement =

        document.scrollingElement;



      const previousHtmlBehavior =

        html.style.scrollBehavior;



      const previousBodyBehavior =

        body.style.scrollBehavior;



      html.style.scrollBehavior =

        "auto";



      body.style.scrollBehavior =

        "auto";



      // Main browser/document scroll

      window.scrollTo(

        0,

        0

      );



      if (scrollingElement) {

        scrollingElement.scrollTop =

          0;



        scrollingElement.scrollLeft =

          0;

      }



      html.scrollTop = 0;

      html.scrollLeft = 0;



      body.scrollTop = 0;

      body.scrollLeft = 0;



      // React root can itself become the scroll container

      const root =

        document.getElementById(

          "root"

        );



      if (root) {

        root.scrollTop = 0;

        root.scrollLeft = 0;

      }



      // Reset nested layout scroll containers too.

      // This fixes pages where PublicLayout / AccountLayout /

      // AdminLayout etc. use overflow-y-auto or overflow-y-scroll.

      const elements =

        document.querySelectorAll(

          "body *"

        );



      elements.forEach(

        (element) => {

          if (

            !(element instanceof HTMLElement)

          ) {

            return;

          }



          if (

            element.scrollTop <= 0 &&

            element.scrollLeft <= 0

          ) {

            return;

          }



          const styles =

            window.getComputedStyle(

              element

            );



          const overflowY =

            styles.overflowY;



          const overflowX =

            styles.overflowX;



          const canScrollY =

            (

              overflowY ===

                "auto" ||

              overflowY ===

                "scroll"

            ) &&

            element.scrollHeight >

              element.clientHeight;



          const canScrollX =

            (

              overflowX ===

                "auto" ||

              overflowX ===

                "scroll"

            ) &&

            element.scrollWidth >

              element.clientWidth;



          if (canScrollY) {

            element.scrollTop = 0;

          }



          if (canScrollX) {

            element.scrollLeft = 0;

          }

        }

      );



      html.style.scrollBehavior =

        previousHtmlBehavior;



      body.style.scrollBehavior =

        previousBodyBehavior;

    };



    // 1. before paint

    resetScroll();



    // 2. after React has painted the new route

    raf1 =

      requestAnimationFrame(

        () => {

          resetScroll();



          // 3. one more frame for layout components / images

          raf2 =

            requestAnimationFrame(

              resetScroll

            );

        }

      );



    // 4. final fallback for delayed layout/browser restoration

    timeoutId =

      window.setTimeout(

        resetScroll,

        80

      );



    return () => {

      cancelAnimationFrame(

        raf1

      );



      cancelAnimationFrame(

        raf2

      );



      clearTimeout(

        timeoutId

      );

    };

  }, [

    location.pathname,

    location.search,

    location.hash,

    location.key,

  ]);



  return null;

};



const App = () => (

  <LocationProvider>

    <ScrollToTop />

    <PartnerReferralCapture />



    <Routes>

      <Route element={<PublicLayout />}>

        <Route index element={<Home />} />

        <Route path="/gifts" element={<Gifts />} />

        <Route path="/collections/:slug" element={<Collection />} />

        <Route path="/products/:slug" element={<ProductDetails />} />

        <Route path="/custom-hamper" element={<CustomHamper />} />

        <Route path="/hamper-one" element={<HamperOne />} />

        <Route path="/event-partners" element={<EventPartners />} />

        <Route path="/partners" element={<Navigate to="/event-partners" replace />} />



        <Route path="/corporate" element={<Navigate to="/custom-hamper?mode=bulk&purpose=corporate" replace />} />

        <Route path="/weddings" element={<Navigate to="/custom-hamper?mode=bulk&purpose=wedding" replace />} />

        <Route path="/diwali" element={<Navigate to="/gifts?category=diwali-hampers" replace />} />



        <Route path="/login" element={<Login />} />

        <Route path="/signup" element={<Signup />} />

        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route path="/verify-otp" element={<VerifyOTP />} />

        <Route path="/partner/login" element={<PartnerLogin />} />

        <Route path="/partner/register" element={<PartnerRegister />} />

      </Route>



      <Route element={<ProtectedRoute />}>

        <Route element={<PublicLayout />}>

          <Route path="/cart" element={<Cart />} />

          <Route path="/checkout" element={<Checkout />} />

          <Route path="/order-success/:orderId" element={<OrderSuccess />} />

        </Route>



        <Route path="/account" element={<AccountLayout />}>

          <Route index element={<AccountDashboard />} />

          <Route path="profile" element={<Profile />} />

          <Route path="addresses" element={<Addresses />} />

          <Route path="orders" element={<Orders />} />

          <Route path="orders/:orderId" element={<OrderDetails />} />

          <Route path="payments" element={<Payments />} />

          <Route path="payments/:paymentId" element={<PaymentDetails />} />

          <Route path="notifications" element={<Navigate to="/account" replace />} />

          <Route path="refunds" element={<Refunds />} />

          <Route path="reviews" element={<MyReviews />} />

          <Route path="support" element={<Support />} />

          <Route path="support/:ticketId" element={<SupportTicketDetails />} />



          <Route path="rfqs" element={<Navigate to="/account/corporate/rfqs" replace />} />

          <Route path="quotes" element={<Navigate to="/account/corporate/quotes" replace />} />

          <Route path="corporate" element={<Navigate to="/account/corporate/rfqs" replace />} />

          <Route path="corporate/campaigns" element={<Navigate to="/account/corporate/rfqs" replace />} />

          <Route path="corporate/campaigns/:id" element={<Navigate to="/account/corporate/rfqs" replace />} />

          <Route path="corporate/campaigns/:id/recipients" element={<Navigate to="/account/corporate/rfqs" replace />} />

          <Route path="corporate/rfqs" element={<AccountRFQs />} />

          <Route path="corporate/rfqs/new" element={<Navigate to="/custom-hamper?mode=bulk" replace />} />

          <Route path="corporate/rfqs/:id" element={<AccountRFQDetails />} />

          <Route path="corporate/quotes" element={<AccountQuotes />} />

          <Route path="corporate/quotes/:id" element={<AccountQuoteDetails />} />



          <Route path="weddings" element={<Navigate to="/custom-hamper?mode=bulk&purpose=wedding" replace />} />

          <Route path="weddings/brief" element={<Navigate to="/custom-hamper?mode=bulk&purpose=wedding" replace />} />

          <Route path="weddings/:id/edit" element={<Navigate to="/account/corporate/rfqs" replace />} />

          <Route path="weddings/:id" element={<Navigate to="/account/corporate/rfqs" replace />} />

          <Route path="weddings/:id/concepts" element={<Navigate to="/account/corporate/rfqs" replace />} />

          <Route path="weddings/:id/quotes" element={<Navigate to="/account/corporate/quotes" replace />} />

          <Route path="weddings/:id/approvals" element={<Navigate to="/account/corporate/rfqs" replace />} />

          <Route path="weddings/:id/guests" element={<Navigate to="/account/corporate/rfqs" replace />} />

          <Route path="partner" element={<Navigate to="/event-partners" replace />} />

        </Route>

      </Route>



      <Route element={<PartnerRoute requireApproved={false} />}>

        <Route

          path="/partner"

          element={

            <PartnerProvider>

              <PartnerLayout />

            </PartnerProvider>

          }

        >

          <Route index element={<PartnerDashboard />} />

          <Route path="status" element={<PartnerApplicationStatus />} />

          <Route path="projects" element={<PartnerProjects />} />

          <Route path="projects/:id" element={<PartnerProjectDetails />} />

          <Route path="showcases" element={<PartnerShowcases />} />

          <Route path="client-actions" element={<PartnerClientActions />} />

          <Route path="orders" element={<PartnerOrders />} />

          <Route path="commissions" element={<PartnerCommissions />} />

          <Route path="payouts" element={<PartnerPayouts />} />

          <Route path="analytics" element={<PartnerAnalytics />} />

          <Route path="documents" element={<PartnerDocuments />} />

          <Route path="profile" element={<PartnerProfile />} />

        </Route>

      </Route>



      <Route element={<ProtectedRoute allowedRoles={["admin", "operations"]} />}>

        <Route path="/admin" element={<AdminLayout />}>

          <Route index element={<AdminDashboard />} />

          <Route path="analytics/search" element={<AdminSearchAnalytics />} />



          <Route path="catalog/products" element={<Products />} />

          <Route path="catalog/products/new" element={<ProductForm />} />

          <Route path="catalog/products/:productId/edit" element={<ProductForm />} />

          <Route path="catalog/categories" element={<Categories />} />

          <Route path="catalog/collections" element={<Collections />} />

          <Route path="catalog/components" element={<Components />} />

          <Route path="catalog/containers" element={<Containers />} />

          <Route path="catalog/product-master-import" element={<ProductMasterImport />} />

          <Route path="master-control" element={<AdminMasterControl />} />



          <Route path="orders" element={<AdminOrders />} />

          <Route path="orders/:orderId" element={<AdminOrderDetails />} />

          <Route path="payments" element={<AdminPayments />} />

          <Route path="payments/:paymentId" element={<AdminPaymentDetails />} />

          <Route path="refunds" element={<AdminRefunds />} />

          <Route path="reviews" element={<AdminReviews />} />

          <Route path="support" element={<AdminSupportTickets />} />

          <Route path="support/:ticketId" element={<AdminSupportTicketDetails />} />



          <Route path="rfqs" element={<AdminRFQs />} />

          <Route path="rfqs/:id" element={<AdminRFQDetails />} />

          <Route path="quotes" element={<AdminQuotes />} />

          <Route path="quotes/:id" element={<AdminQuoteDetails />} />

          <Route path="approvals" element={<AdminApprovals />} />

          <Route path="corporate" element={<AdminCorporate />} />

          <Route path="corporate/:id" element={<AdminCorporateDetails />} />

          <Route path="weddings" element={<AdminWeddings />} />

          <Route path="weddings/:id" element={<AdminWeddingDetails />} />



          <Route path="partners" element={<AdminPartners />} />

          <Route path="partners/:id" element={<AdminPartnerDetails />} />

          <Route path="partner-showcases" element={<AdminPartnerShowcases />} />

          <Route path="commissions" element={<AdminCommissions />} />

          <Route path="payouts" element={<AdminPayouts />} />



          <Route path="production" element={<AdminProduction />} />

          <Route path="fulfilment" element={<AdminFulfilment />} />


        </Route>

      </Route>



      <Route path="/showcase/:token" element={<ShowcaseLayout />}>

        <Route index element={<ShowcaseAccess />} />

        <Route path="view" element={<ShowcaseView />} />

      </Route>



      <Route

        path="*"

        element={

          <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">

            <div className="text-center">

              <h1 className="text-7xl font-bold text-[#F26522]">404</h1>

              <p className="mt-4 text-xl font-semibold">Page not found</p>

              <p className="mt-2 text-gray-500">The page you are looking for does not exist.</p>

            </div>

          </div>

        }

      />

    </Routes>

  </LocationProvider>

);



export default App;
