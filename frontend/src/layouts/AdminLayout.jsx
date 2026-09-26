import { useEffect, useState } from "react";



import { NavLink, Outlet, useNavigate } from "react-router-dom";







import { useAuth } from "../context/AuthContext.jsx";



import logo from "../assets/images/logo_dark.jpeg";







const useTransparentLogo = (source) => {



  const [processedLogo, setProcessedLogo] = useState(source);







  useEffect(() => {



    if (!source) return undefined;







    let cancelled = false;



    const image = new Image();







    image.onload = () => {



      try {



        const canvas = document.createElement("canvas");



        canvas.width = image.naturalWidth;



        canvas.height = image.naturalHeight;







        const context = canvas.getContext("2d", {



          willReadFrequently: true,



        });







        if (!context) return;







        context.drawImage(image, 0, 0);







        const imageData = context.getImageData(



          0,



          0,



          canvas.width,



          canvas.height



        );







        const data = imageData.data;



        const width = canvas.width;



        const height = canvas.height;



        const visited = new Uint8Array(width * height);



        const queue = [];







        const isWhite = (r, g, b) =>



          r > 218 &&



          g > 218 &&



          b > 218 &&



          Math.max(r, g, b) - Math.min(r, g, b) < 28;







        const push = (x, y) => {



          if (



            x < 0 ||



            y < 0 ||



            x >= width ||



            y >= height



          ) {



            return;



          }







          const pixel = y * width + x;







          if (visited[pixel]) return;







          const index = pixel * 4;







          if (



            !isWhite(



              data[index],



              data[index + 1],



              data[index + 2]



            )



          ) {



            return;



          }







          visited[pixel] = 1;



          queue.push(pixel);



        };







        for (let x = 0; x < width; x += 1) {



          push(x, 0);



          push(x, height - 1);



        }







        for (let y = 0; y < height; y += 1) {



          push(0, y);



          push(width - 1, y);



        }







        let queueIndex = 0;







        while (queueIndex < queue.length) {



          const pixel = queue[queueIndex++];



          const x = pixel % width;



          const y = Math.floor(pixel / width);







          data[pixel * 4 + 3] = 0;







          push(x + 1, y);



          push(x - 1, y);



          push(x, y + 1);



          push(x, y - 1);



        }







        context.putImageData(imageData, 0, 0);







        if (!cancelled) {



          setProcessedLogo(



            canvas.toDataURL("image/png")



          );



        }



      } catch {



        if (!cancelled) {



          setProcessedLogo(source);



        }



      }



    };







    image.onerror = () => {



      if (!cancelled) {



        setProcessedLogo(source);



      }



    };







    image.src = source;







    return () => {



      cancelled = true;



    };



  }, [source]);







  return processedLogo;



};







const navClass = ({ isActive }) =>



  `group relative flex min-h-[42px] items-center gap-3 px-6 text-[12px] font-semibold tracking-[0.01em] transition-all duration-200 ${



    isActive



      ? "bg-white/[0.07] text-white"



      : "text-white/50 hover:bg-white/[0.04] hover:text-white"



  }`;







const AdminLayout = () => {



  const { user, logout } = useAuth();



  const navigate = useNavigate();



  const transparentLogo = useTransparentLogo(logo);



  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);



  useEffect(() => {

    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => { document.body.style.overflow = previousOverflow; };

  }, [mobileMenuOpen]);









  const handleLogout = async () => {



    await logout();



    navigate("/");



  };







  return (



    <div className="min-h-screen bg-[#F7F6F3] text-[#171717] lg:grid lg:h-screen lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)] lg:overflow-hidden">



      <div className="sticky top-0 z-40 flex h-[68px] items-center justify-between border-b border-black/[0.07] bg-[#FFFDF9]/95 px-3.5 shadow-[0_8px_30px_rgba(30,22,12,.06)] backdrop-blur-xl sm:px-5 lg:hidden">

        <button type="button" onClick={() => navigate("/admin")} className="group flex min-w-0 items-center gap-2.5 text-left" aria-label="HAMPORIUM home">
          <span className="flex h-[50px] w-[38px] shrink-0 items-center justify-center sm:h-[56px] sm:w-[46px]">
            <img
              src={transparentLogo}
              alt=""
              className="block h-full w-full object-contain transition duration-300 group-hover:scale-[1.025]"
            />
          </span>
          <span className="min-w-0">
            <strong
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              className="block truncate text-[19px] font-semibold leading-none tracking-[0.04em] text-[#252119] sm:text-[24px] sm:tracking-[0.065em]"
            >
              HAMPORIUM
            </strong>
            <small className="mt-[6px] block truncate text-[7.3px] font-medium leading-none tracking-[0.01em] text-[#71695D] sm:text-[8px] sm:tracking-[0.035em]">
              The art of thoughtful gifting
            </small>
          </span>
        </button>

        <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open admin navigation" aria-expanded={mobileMenuOpen} className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-[5px] rounded-[14px] border border-[#D4AF37]/25 bg-[#171717] text-white shadow-[0_8px_20px_rgba(0,0,0,.14)] transition active:scale-95">

          <span className="h-[1.5px] w-[18px] rounded-full bg-[#F4D574]"/><span className="h-[1.5px] w-[14px] translate-x-[2px] rounded-full bg-white"/><span className="h-[1.5px] w-[18px] rounded-full bg-[#F4D574]"/>

        </button>

      </div>

      {mobileMenuOpen && <button type="button" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] lg:hidden"/>}



      <aside

        onClickCapture={(event) => { if (event.target.closest("a[href]")) setMobileMenuOpen(false); }}

        className={`fixed inset-y-0 left-0 z-50 w-[min(88vw,320px)] min-w-0 overflow-y-auto bg-[#171717] text-white shadow-[28px_0_70px_rgba(0,0,0,.30)] transition-transform duration-300 ease-out [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:static lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0 lg:shadow-none ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}

      >

        <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close admin navigation" className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[22px] font-light leading-none text-white/70 lg:hidden">×</button>



        <div className="flex min-h-full flex-col">



          <button



            type="button"



            onClick={() => navigate("/admin")}



            className="group w-full shrink-0 border-b border-white/[0.07] px-6 py-5 text-left"



          >

            <div className="flex items-center gap-[10px]">
              <span className="flex h-[64px] w-[54px] shrink-0 items-center justify-center">
                <img
                  src={transparentLogo}
                  alt=""
                  className="block h-full w-full object-contain transition duration-300 group-hover:scale-[1.025]"
                />
              </span>
              <span className="min-w-0">
                <span
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                  className="block truncate text-[25px] font-semibold leading-none tracking-[0.065em] text-white"
                >
                  HAMPORIUM
                </span>
                <span className="mt-[7px] block truncate text-[9px] font-medium leading-none tracking-[0.035em] text-white/55">
                  The art of thoughtful gifting
                </span>
              </span>
            </div>

          </button>







          <nav className="flex-1 pb-5 pt-2">



            <NavItem



              end



              to="/admin"



              label="Dashboard"



              icon={<GridIcon />}



            />







            <Section number="01" first>



              Orders



            </Section>







            <NavItem



              to="/admin/orders"



              label="All Orders"



              icon={<BagIcon />}



            />







            <NavItem



              to="/admin/production"



              label="Prepare Orders"



              icon={<ToolsIcon />}



            />







            <NavItem



              to="/admin/fulfilment"



              label="Ship & Deliver"



              icon={<TruckIcon />}



            />







            <NavItem



              to="/admin/payments"



              label="Payments"



              icon={<CardIcon />}



            />







            <NavItem



              to="/admin/refunds"



              label="Refunds"



              icon={<RefundIcon />}



            />







            <Section number="02">



              Bulk & Custom



            </Section>







            <NavItem



              to="/admin/rfqs"



              label="RFQs"



              icon={<DocumentIcon />}



            />







            <NavItem



              to="/admin/quotes"



              label="Quotations"



              icon={<QuoteIcon />}



            />







            <NavItem



              to="/admin/approvals"



              label="Artwork Approvals"



              icon={<CheckIcon />}



            />







            <Section number="03">



              Catalogue



            </Section>







            <NavItem



              to="/admin/catalog/products"



              label="Products"



              icon={<CubeIcon />}



            />







            <NavItem



              to="/admin/catalog/categories"



              label="Categories"



              icon={<GridIcon />}



            />







            <NavItem



              to="/admin/catalog/collections"



              label="Collections"



              icon={<CollectionIcon />}



            />







            <NavItem



              to="/admin/catalog/components"



              label="Hamper Items"



              icon={<BlocksIcon />}



            />







            <NavItem



              to="/admin/catalog/containers"



              label="Boxes / Containers"



              icon={<BoxIcon />}



            />







            <NavItem



              to="/admin/catalog/product-master-import"



              label="Product Import"



              icon={<UploadIcon />}



            />







            <NavItem



              to="/admin/master-control"



              label="Master Control"



              icon={<PercentIcon />}



            />







            <Section number="04">



              Customers



            </Section>







            <NavItem



              to="/admin/reviews"



              label="Customer Reviews"



              icon={<StarIcon />}



            />







            <NavItem



              to="/admin/support"



              label="Support Tickets"



              icon={<SupportIcon />}



            />







            <Section number="05">



              Partners



            </Section>







            <NavItem



              to="/admin/partners"



              label="Partners"



              icon={<UsersIcon />}



            />







            <NavItem



              to="/admin/partner-showcases"



              label="Showcases"



              icon={<ScreenIcon />}



            />







            <NavItem



              to="/admin/commissions"



              label="Commissions"



              icon={<PercentIcon />}



            />







            <NavItem



              to="/admin/payouts"



              label="Payouts"



              icon={<WalletIcon />}



            />







            <Section number="06">



              Insights



            </Section>







            <NavItem



              to="/admin/analytics/search"



              label="Search Analytics"



              icon={<SearchIcon />}



            />



          </nav>







          <div className="shrink-0 border-t border-white/[0.07] px-6 py-4">



            <div className="flex items-center justify-between gap-3">



              <div className="min-w-0 flex-1">



                <p className="truncate font-serif text-[14px] font-semibold text-white">



                  {user?.name || "Administrator"}



                </p>







                <p className="mt-1 truncate text-[10px] text-white/35">



                  {user?.email}



                </p>



              </div>







              <button



                type="button"



                onClick={handleLogout}



                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.1] text-white/35 transition hover:border-red-400/30 hover:text-red-400"



                title="Logout"



              >



                <LogoutIcon />



              </button>



            </div>



          </div>



        </div>



      </aside>







      <main className="min-w-0 bg-[#F7F6F3] lg:h-screen lg:overflow-y-auto">



        <div className="w-full px-4 py-5 sm:px-7 sm:py-6 lg:px-10 lg:py-8 xl:px-12 2xl:px-14">



          <Outlet />



        </div>



      </main>



    </div>



  );



};







const NavItem = ({



  to,



  label,



  icon,



  end = false,



}) => (



  <NavLink



    end={end}



    to={to}



    className={navClass}



  >



    {({ isActive }) => (



      <>



        <span



          className={`absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full ${



            isActive



              ? "bg-[#F97316]"



              : "bg-transparent"



          }`}



        />







        <span



          className={`flex h-7 w-7 shrink-0 items-center justify-center ${



            isActive



              ? "text-[#F97316]"



              : "text-white/25 group-hover:text-[#D4AF37]"



          }`}



        >



          {icon}



        </span>







        <span className="truncate">



          {label}



        </span>



      </>



    )}



  </NavLink>



);







const Section = ({



  children,



  number,



  first = false,



}) => (



  <div



    className={`mb-1.5 flex items-center gap-3 px-6 ${



      first ? "mt-3" : "mt-5"



    }`}



  >



    <span className="font-serif text-[10px] italic text-[#D4AF37]/80">



      {number}



    </span>







    <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.20em] text-white/25">



      {children}



    </span>







    <span className="h-px flex-1 bg-white/[0.07]" />



  </div>



);







const Icon = ({ children }) => (



  <svg



    viewBox="0 0 24 24"



    fill="none"



    stroke="currentColor"



    strokeWidth="1.5"



    strokeLinecap="round"



    strokeLinejoin="round"



    className="h-[17px] w-[17px]"



    aria-hidden="true"



  >



    {children}



  </svg>



);







const GridIcon = () => (



  <Icon>



    <rect x="4" y="4" width="6" height="6" rx="1" />



    <rect x="14" y="4" width="6" height="6" rx="1" />



    <rect x="4" y="14" width="6" height="6" rx="1" />



    <rect x="14" y="14" width="6" height="6" rx="1" />



  </Icon>



);







const SearchIcon = () => (



  <Icon>



    <circle cx="10" cy="10" r="5" />



    <path d="m14 14 5 5" />



  </Icon>



);







const CubeIcon = () => (



  <Icon>



    <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />



    <path d="m4 8.5 8 4.5 8-4.5M12 13v7" />



  </Icon>



);







const CollectionIcon = () => (



  <Icon>



    <path d="M4 7h16v12H4V7Z" />



    <path d="M7 4h10M8 11h8M8 15h5" />



  </Icon>



);







const BlocksIcon = () => (



  <Icon>



    <circle cx="8" cy="8" r="3" />



    <rect x="13" y="5" width="6" height="6" rx="1" />



    <path d="M5 18h6M14 15h5M8 15v6M16.5 13v5" />



  </Icon>



);







const BoxIcon = () => <CubeIcon />;







const UploadIcon = () => (



  <Icon>



    <path d="M12 20V7" />



    <path d="m8 11 4-4 4 4" />



    <path d="M5 4h14" />



  </Icon>



);







const BagIcon = () => (



  <Icon>



    <path d="M5 7h14l-1 13H6L5 7Z" />



    <path d="M9 9V5a3 3 0 0 1 6 0v4" />



  </Icon>



);







const CardIcon = () => (



  <Icon>



    <rect x="3" y="6" width="18" height="13" rx="2" />



    <path d="M3 10h18M7 15h4" />



  </Icon>



);







const RefundIcon = () => (



  <Icon>



    <path d="M7 7H4V4" />



    <path d="M4.5 7.5A8 8 0 1 1 4 14" />



  </Icon>



);







const StarIcon = () => (



  <Icon>



    <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />



  </Icon>



);







const DocumentIcon = () => (



  <Icon>



    <path d="M6 3h8l4 4v14H6V3Z" />



    <path d="M14 3v5h5M9 13h6M9 17h4" />



  </Icon>



);







const QuoteIcon = () => (



  <Icon>



    <path d="M5 5h14v14H5V5Z" />



    <path d="M8 9h8M8 13h5" />



  </Icon>



);







const CheckIcon = () => (



  <Icon>



    <circle cx="12" cy="12" r="8" />



    <path d="m8.5 12 2.2 2.2 4.8-5" />



  </Icon>



);







const UsersIcon = () => (



  <Icon>



    <circle cx="9" cy="8" r="3" />



    <path d="M3 20c.5-3.5 2.5-5.5 6-5.5s5.5 2 6 5.5" />



    <path d="M15 6.5a3 3 0 0 1 0 5.8M17 15c2.3.5 3.7 2.1 4 5" />



  </Icon>



);







const PercentIcon = () => (



  <Icon>



    <path d="m6 18 12-12" />



    <circle cx="7.5" cy="7.5" r="2" />



    <circle cx="16.5" cy="16.5" r="2" />



  </Icon>



);







const ScreenIcon = () => (



  <Icon>



    <rect x="3" y="4" width="18" height="13" rx="2" />



    <path d="M8 21h8M12 17v4" />



  </Icon>



);







const WalletIcon = () => (



  <Icon>



    <path d="M4 6h14a2 2 0 0 1 2 2v10H4V6Z" />



    <path d="M4 6V4h12M15 11h5v4h-5a2 2 0 0 1 0-4Z" />



  </Icon>



);







const ToolsIcon = () => (



  <Icon>



    <path d="m14 6 4-2 2 2-2 4-4 1-7 7-3-3 7-7 1-4 2-2Z" />



  </Icon>



);







const TruckIcon = () => (



  <Icon>



    <path d="M3 6h11v10H3V6ZM14 10h4l3 3v3h-7v-6Z" />



    <circle cx="7" cy="18" r="2" />



    <circle cx="17" cy="18" r="2" />



  </Icon>



);







const SupportIcon = () => (



  <Icon>



    <path d="M4 5h16v11H8l-4 4V5Z" />



    <path d="M8 9h8M8 13h5" />



  </Icon>



);







const LogoutIcon = () => (



  <Icon>



    <path d="M10 5H5v14h5" />



    <path d="M14 8l4 4-4 4M18 12H9" />



  </Icon>



);







export default AdminLayout;
