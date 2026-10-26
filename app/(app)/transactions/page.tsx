import { TransactionsView } from "@/components/TransactionsView";
import { getTransactions } from "@/lib/data";
import { monthOrCurrent } from "@/lib/month";
import { TX_TYPES, type TxType } from "@/lib/types";

interface Search {
  month?: string;
  type?: string;
  categoryId?: string;
  q?: string;
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const month = monthOrCurrent(sp.month);
  const type = TX_TYPES.includes(sp.type as TxType) ? (sp.type as TxType) : "";
  const categoryId = sp.categoryId === "none" || /^\d+$/.test(sp.categoryId ?? "") ? sp.categoryId! : "";
  const q = sp.q ?? "";
  const items = await getTransactions({
    month,
    type: type || undefined,
    categoryId: categoryId === "none" ? null : categoryId ? Number(categoryId) : undefined,
    q,
  });
  return <TransactionsView month={month} type={type} categoryId={categoryId} q={q} items={items} />;
}
