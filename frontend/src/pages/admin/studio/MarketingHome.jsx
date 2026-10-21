
import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Page, Section, Notice, secondary } from "../../../components/adminStudio/StudioUI.jsx";

const tasks = [
  { title: "Occasions", description: "Organise Diwali, birthdays, weddings and other gifting collections.", to: "/admin/studio/occasions", action: "Manage occasions" },
  { title: "Campaigns", description: "Plan and publish banners, events and promotional campaigns.", to: "/admin/studio/campaigns", action: "Manage campaigns" },
];

export default function MarketingHome() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin");
  return <Page eyebrow="HAMPORIUM / MARKETING" title="Marketing" description="Occasions and campaigns in one simple workspace. Collection management and promotions remain separate from product stock and selling prices.">
    <Section title="Gifting & campaigns" description="Choose what you want to update.">
      <div className="grid gap-3 sm:grid-cols-2">{tasks.map((task) => <Link key={task.to} to={task.to} className="group rounded-2xl border border-[#E7DFD3] bg-[#FFFEFC] p-5 transition hover:border-[#B99A6B] hover:shadow-sm"><h3 className="text-[17px] font-bold">{task.title}</h3><p className="mt-2 min-h-[45px] text-[12px] leading-5 text-black/55">{task.description}</p><span className="mt-4 inline-block text-[12px] font-bold text-[#927147]">{task.action} →</span></Link>)}</div>
    </Section>
    <Notice>Excel Occasion Master updates are controlled by a separate <strong>preview → review → confirm</strong> sync. Uploading a marketing workbook does not automatically publish banners, modify product prices or update stock.</Notice>
    {isAdmin && <Section title="Update occasion data from Excel" description="Only when your manager changes the occasion calendar, links or regional reference data."><Link to="/admin/studio/excel-sync" className={secondary}>Open Marketing Excel Sync →</Link></Section>}

  </Page>;
}
