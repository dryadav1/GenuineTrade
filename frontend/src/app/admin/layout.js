import AdminLayoutClient from "@/components/admin/AdminLayoutClient";

export const metadata = {
  title: "Admin | GenuineTrade",
  description: "Professional admin workspace for users, verification, subscriptions, transactions, analytics, and settings."
};

export default function AdminLayout({ children }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
