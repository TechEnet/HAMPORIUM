
import { Link } from "react-router-dom";
import { Page, Section, Notice, primary, secondary } from "../../../components/adminStudio/StudioUI.jsx";

const primaryTasks = [
  { title: "Products & Hampers", note: "Create, edit, publish or archive ready-made hampers.", link: "/admin/catalog/products", action: "Manage products", number: "01" },
  { title: "Hamper Items", note: "Manage gifts and components used inside hampers.", link: "/admin/catalog/components", action: "Manage items", number: "02" },
  { title: "Boxes & Packaging", note: "Maintain box specifications, pricing and availability.", link: "/admin/catalog/containers", action: "Manage boxes", number: "03" },
  { title: "Inventory", note: "Check verified quantities and records awaiting stock confirmation.", link: "/admin/studio/inventory", action: "Check stock", number: "04" },
];

export default function StudioHome() {
  return (
    <Page eyebrow="HAMPORIUM / CATALOGUE" title="Catalogue" description="One place to manage your products, gift items and boxes. Excel and manual entry work with the same existing catalogue." actions={<Link to="/admin/catalog/products/new" className={primary}>+ Create hamper</Link>}>
      <Notice tone="warning"><strong>Live website protection:</strong> Existing published hampers remain published after a normal marketing Excel sync. Stock import is not activated until the approved source is confirmed. Never use a legacy replace-catalogue import on production.</Notice>
      <Section title="What would you like to manage?" description="Choose a task. You don't need to understand Excel sheet names to use these tools.">
        <div className="grid gap-3 sm:grid-cols-2">
          {primaryTasks.map((item) => (
            <Link to={item.link} key={item.link} className="group flex min-h-[153px] flex-col justify-between rounded-2xl border border-[#E7DFD3] bg-[#FFFEFC] p-5 transition hover:-translate-y-0.5 hover:border-[#B99A6B] hover:shadow-sm">
              <div><span className="text-[10px] font-bold tracking-[.15em] text-[#AE8550]">{item.number}</span><h3 className="mt-2 text-[17px] font-bold text-[#2C251C]">{item.title}</h3><p className="mt-2 max-w-[350px] text-[12px] leading-5 text-black/55">{item.note}</p></div>
              <span className="mt-4 text-[12px] font-bold text-[#927147]">{item.action} →</span>
            </Link>
          ))}
        </div>
      </Section>
      <Section title="Imports & organisation" description="Use these only when you need to upload or reorganise data.">
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/studio/import" className={secondary}>Excel import</Link>
          <Link to="/admin/catalog/categories" className={secondary}>Categories</Link>
          <Link to="/admin/catalog/collections" className={secondary}>Collections</Link>
        </div>
      </Section>
    </Page>
  );
}
