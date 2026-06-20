import { getCurrentUser, getCategories, getCards } from "@/app/actions";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/DashboardClient";

export const revalidate = 0; // Dynamic rendering

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [categories, cards] = await Promise.all([
    getCategories(),
    getCards(),
  ]);

  // Convert schema Card properties to match DashboardClient expectation
  const formattedCards = cards.map((card) => ({
    ...card,
    metadata: card.metadata as any,
  }));

  return (
    <DashboardClient
      user={user}
      initialCategories={categories}
      initialCards={formattedCards}
    />
  );
}
