import { getCurrentUser, getCategories, getCards } from "@/lib/queries";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/DashboardClient";

export const revalidate = 0; // Dynamic rendering

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [categories, cards] = await Promise.all([
    getCategories(user.id),
    getCards(user.id),
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
