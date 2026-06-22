/**
 * test-auth-flow.js
 * 
 * Runtime verification of authentication routing:
 *  - TEST 1: Unauthenticated GET / → 307 redirect to /login
 *  - TEST 2: Authenticated GET / → 200 OK (cookies injected in the format
 *    that @supabase/ssr server client can read)
 * 
 * Uses the Supabase admin API to create an auto-confirmed test user,
 * then signs in to extract a valid access_token. Cookie format is
 * JSON-serialized session as written by @supabase/ssr's setItem call.
 */

const { createClient } = require("@supabase/supabase-js");
const http = require("http");
const { exec } = require("child_process");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectId = "fzqnyzipoiuevosznoxg"; // extracted from Supabase URL

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Utility to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Build the @supabase/ssr-compatible cookie header for a session.
 * The server client reads cookies via getAll() and looks for a key
 * matching `sb-<project>-auth-token`. It stores the raw JSON string
 * of the session object (what auth-js writes with JSON.stringify).
 */
function buildSessionCookieHeader(session) {
  const cookieKey = `sb-${projectId}-auth-token`;
  // @supabase/ssr stores the entire session JSON as the cookie value.
  // auth-js calls storage.setItem(key, JSON.stringify(session)),
  // so the raw JSON string is what goes in the cookie.
  const cookieValue = JSON.stringify(session);
  return `${cookieKey}=${encodeURIComponent(cookieValue)}`;
}

function httpGet(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function run() {
  console.log("==========================================");
  console.log("RUNNING AUTHENTICATION ROUTING FLOW TESTS");
  console.log("==========================================");

  let devProcess;
  const testEmail = `testuser_flow_${Date.now()}@gmail.com`;
  const testPassword = "TestPassword99!";

  try {
    // ── Step 1: Start dev server ─────────────────────────────────────────────
    console.log("\n[SETUP] Starting Next.js dev server on port 3005...");
    devProcess = exec("npx next dev -p 3005", { cwd: process.cwd() });
    await sleep(10000);
    console.log("[SETUP] Server assumed online.\n");

    // ── Step 2: Create auto-confirmed test user via admin API ────────────────
    console.log(`[SETUP] Creating verified test user: ${testEmail}`);
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });
    if (createError) {
      throw new Error(`Admin user creation failed: ${createError.message}`);
    }

    // ── Step 3: Sign in to get a valid session ───────────────────────────────
    console.log("[SETUP] Signing in to get session...");
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    if (signInError) {
      throw new Error(`Sign-in failed: ${signInError.message}`);
    }
    const session = signInData.session;
    console.log(`[SETUP] Got valid session. User: ${session.user.email}\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Unauthenticated request → must redirect to /login
    // ─────────────────────────────────────────────────────────────────────────
    console.log("TEST 1: GET / without cookies (unauthenticated)...");
    const res1 = await httpGet({
      host: "localhost",
      port: 3005,
      path: "/",
      method: "GET"
    });
    console.log(`  Status:   ${res1.status}`);
    console.log(`  Location: ${res1.headers.location}`);
    if (res1.status === 307 && res1.headers.location === "/login") {
      console.log("  [PASS] Unauthenticated → 307 redirect to /login ✓\n");
    } else {
      throw new Error(`TEST 1 FAILED: expected 307 /login, got ${res1.status} ${res1.headers.location}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Authenticated request (session cookie injected) → must return 200
    // ─────────────────────────────────────────────────────────────────────────
    console.log("TEST 2: GET / with valid session cookie (authenticated)...");
    const cookieHeader = buildSessionCookieHeader(session);
    const res2 = await httpGet({
      host: "localhost",
      port: 3005,
      path: "/",
      method: "GET",
      headers: {
        "Cookie": cookieHeader
      }
    });
    console.log(`  Status:       ${res2.status}`);
    console.log(`  Location:     ${res2.headers.location ?? "(none)"}`);
    console.log(`  Content-Type: ${res2.headers["content-type"] ?? "(none)"}`);
    if (res2.status === 200) {
      console.log("  [PASS] Authenticated → 200 OK ✓\n");
    } else {
      throw new Error(`TEST 2 FAILED: expected 200, got ${res2.status} (location: ${res2.headers.location})`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    console.log("==========================================");
    console.log("ALL AUTHENTICATION ROUTING TESTS PASSED");
    console.log("==========================================");

  } catch (err) {
    console.error("\n[FAIL] Auth flow integration test failed:", err.message);
    process.exit(1);
  } finally {
    // ── Cleanup ──────────────────────────────────────────────────────────────
    if (devProcess) {
      console.log("\n[CLEANUP] Terminating dev server...");
      devProcess.kill();
    }
    // Delete test user if it was created
    try {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const testUser = users?.users?.find(u => u.email === testEmail);
      if (testUser) {
        await supabaseAdmin.auth.admin.deleteUser(testUser.id);
        console.log(`[CLEANUP] Deleted test user: ${testEmail}`);
      }
    } catch (_) {
      // Cleanup failure is non-fatal
    }
  }
}

run();
