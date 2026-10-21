
import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Page, Section, Notice, secondary } from "../../../components/adminStudio/StudioUI.jsx";

export default function ExcelImportHome() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin");
  return <Page eyebrow="HAMPORIUM / DATA IMPORT" title="Excel Import" description="Two clear import steps. Upload the Product Master for catalogue details, and use Marketing Sync only when occasion or regional planning needs updating.">
    <Section title="1. Products, hampers & packaging" description="Use your existing Product Master importer. This is the workflow for catalogue records, images, recipes and pricing.">
      <Link to="/admin/catalog/product-master-import" className={secondary}>Open Product Master Import →</Link>
      <p className="mt-3 text-[12px] leading-6 text-black/55">Keep the safe upsert flow. Never choose a destructive replace-catalogue operation on the live site. Existing publication settings must remain preserved.</p>
    </Section>
    {isAdmin && <Section title="2. Occasions, event calendar & geography" description="Preview changes to occasions, hamper-occasion links, campaigns and reference fields from the latest workbook.">
      <Link to="/admin/studio/excel-sync" className={secondary}>Open Marketing Excel Sync →</Link>
      <p className="mt-3 text-[12px] leading-6 text-black/55">This sync does not publish products or campaigns and does not import inventory quantities.</p>
    </Section>}
    <Notice tone="warning"><strong>Inventory sync is not active.</strong> Wait for the manager-approved Excel stock source before connecting inventory records to the storefront.</Notice>
  </Page>;
}
