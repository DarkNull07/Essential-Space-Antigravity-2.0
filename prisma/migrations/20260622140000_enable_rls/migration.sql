-- Enable and force RLS on UserProfile
ALTER TABLE "UserProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserProfile" FORCE ROW LEVEL SECURITY;

-- Enable and force RLS on Category
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" FORCE ROW LEVEL SECURITY;

-- Enable and force RLS on Card
ALTER TABLE "Card" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Card" FORCE ROW LEVEL SECURITY;

-- Create Policies for UserProfile
DROP POLICY IF EXISTS "Users can manage their own profile" ON "UserProfile";
CREATE POLICY "Users can manage their own profile" ON "UserProfile" FOR ALL USING (auth.uid()::text = id);

-- Create Policies for Category
DROP POLICY IF EXISTS "Users can manage their own categories" ON "Category";
CREATE POLICY "Users can manage their own categories" ON "Category" FOR ALL USING (auth.uid()::text = "userId");

-- Create Policies for Card
DROP POLICY IF EXISTS "Users can manage their own cards" ON "Card";
CREATE POLICY "Users can manage their own cards" ON "Card" FOR ALL USING (auth.uid()::text = "userId");
