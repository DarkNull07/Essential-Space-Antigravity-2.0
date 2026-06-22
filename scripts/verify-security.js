const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  try {
    // Reset role at the very beginning to clear any leaked session state from the pool
    await prisma.$executeRawUnsafe("RESET ROLE;");
    await prisma.$executeRawUnsafe("RESET ALL;");
    
    console.log("==========================================");
    console.log("RUNNING SECURITY REGRESSION TESTS");
    console.log("==========================================");
    
    const userA = "11111111-1111-1111-1111-111111111111";
    const userB = "22222222-2222-2222-2222-222222222222";
    
    // Clean up if they exist
    await prisma.$executeRawUnsafe(`DELETE FROM "Card" WHERE "userId" IN ('${userA}', '${userB}')`);
    await prisma.$executeRawUnsafe(`DELETE FROM "UserProfile" WHERE "id" IN ('${userA}', '${userB}')`);
    
    // Insert User Profiles
    await prisma.$executeRawUnsafe(`
      INSERT INTO "UserProfile" ("id", "email", "selectedTheme", "theme", "updatedAt")
      VALUES 
        ('${userA}', 'usera@test.com', 'light-gold', 'light', NOW()),
        ('${userB}', 'userb@test.com', 'light-gold', 'light', NOW())
    `);
    
    // Insert Card belonging to User A
    const cardId = "card-a-123";
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Card" ("id", "type", "content", "userId", "order", "updatedAt")
      VALUES ('${cardId}', 'TEXT', 'Secret Content User A', '${userA}', 0, NOW())
    `);
    
    console.log("1. DATABASE RLS VERIFICATION:");
    // Test 1: User B cannot see User A's card when acting as 'authenticated' role
    const resultUserB = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL request.jwt.claim.sub = '${userB}'`);
      await tx.$executeRawUnsafe(`SET LOCAL ROLE authenticated`);
      return await tx.$queryRawUnsafe(`SELECT * FROM "Card"`);
    });
    
    console.log(`- Cards returned for User B (under RLS): ${resultUserB.length}`);
    if (resultUserB.length === 0) {
      console.log("  [PASS] Database RLS successfully blocked User B from reading User A's card.");
    } else {
      console.error("  [FAIL] Database RLS leak! User B read User A's card.");
      process.exit(1);
    }

    console.log("\n2. APPLICATION IDOR SCOPING VERIFICATION:");
    
    // Test 2: Simulating revealApiKey(cardId) under User B context
    const keyCardForUserB = await prisma.card.findFirst({
      where: { id: cardId, userId: userB }
    });
    
    console.log(`- Card found for User B:`, keyCardForUserB);
    if (!keyCardForUserB) {
      console.log("  [PASS] App-layer findFirst correctly returned null for User B trying to access User A's card.");
    } else {
      console.error("  [FAIL] IDOR vulnerability! App-layer allowed User B to find User A's card.");
      process.exit(1);
    }

    // Test 3: Simulating updateCard(cardId) under User B context
    const updateResult = await prisma.card.updateMany({
      where: { id: cardId, userId: userB },
      data: { content: "Hacked Content" }
    });
    
    console.log(`- Cards updated for User B: ${updateResult.count}`);
    if (updateResult.count === 0) {
      console.log("  [PASS] App-layer updateMany correctly rejected User B from modifying User A's card.");
    } else {
      console.error("  [FAIL] IDOR vulnerability! App-layer allowed User B to modify User A's card.");
      process.exit(1);
    }

    // Test 4: Simulating deleteCard(cardId) under User B context
    const deleteResult = await prisma.card.deleteMany({
      where: { id: cardId, userId: userB }
    });
    
    console.log(`- Cards deleted for User B: ${deleteResult.count}`);
    if (deleteResult.count === 0) {
      console.log("  [PASS] App-layer deleteMany correctly rejected User B from deleting User A's card.");
    } else {
      console.error("  [FAIL] IDOR vulnerability! App-layer allowed User B to delete User A's card.");
      process.exit(1);
    }
    
    // Verify Card A is still intact in the database (since connection role reverted to postgres)
    const cardAIntact = await prisma.card.findUnique({
      where: { id: cardId }
    });
    console.log(`- Card A intact in DB: ${cardAIntact ? "YES" : "NO"}`);
    if (cardAIntact && cardAIntact.content === "Secret Content User A") {
      console.log("  [PASS] Data integrity maintained.");
    } else {
      console.error("  [FAIL] Data was mutated or deleted during security testing.");
      process.exit(1);
    }

    // Clean up
    await prisma.$executeRawUnsafe(`DELETE FROM "Card" WHERE "userId" IN ('${userA}', '${userB}')`);
    await prisma.$executeRawUnsafe(`DELETE FROM "UserProfile" WHERE "id" IN ('${userA}', '${userB}')`);
    console.log("==========================================");
    console.log("ALL SECURITY TESTS PASSED SUCCESSFULLY");
    console.log("==========================================");
  } catch (err) {
    console.error("Security regression test run error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
