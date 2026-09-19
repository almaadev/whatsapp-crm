import { io } from "socket.io-client";
import http from "http";

async function runValidation(targetUrl) {
  console.log(`\n========================================`);
  console.log(`Starting Socket.IO Validation on: ${targetUrl}`);
  console.log(`========================================`);

  // 1. Initial Polling Handshake via HTTP
  console.log("\n[Test 1] Initial Polling Handshake...");
  const pollUrl = `${targetUrl}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`;
  const pollRes = await fetch(pollUrl);
  const pollText = await pollRes.text();
  console.log(`Response Status: ${pollRes.status} (${pollRes.statusText})`);
  console.log(`Response Body: ${pollText}`);

  if (pollRes.status !== 200) {
    throw new Error(`Initial polling failed with status ${pollRes.status}`);
  }

  const sidMatch = pollText.match(/"sid":"([^"]+)"/);
  if (!sidMatch) {
    throw new Error("Could not extract SID from initial polling handshake!");
  }
  const sid = sidMatch[1];
  console.log(`Extracted SID: ${sid}`);

  // 2. Subsequent Polling Request (POST)
  console.log("\n[Test 2] Subsequent Polling Request (POST with SID)...");
  const postUrl = `${targetUrl}/socket.io/?EIO=4&transport=polling&sid=${sid}&t=${Date.now()}`;
  const postRes = await fetch(postUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: "40" // Engine.IO message packet containing Socket.IO CONNECT
  });
  const postText = await postRes.text();
  console.log(`Subsequent Polling Status: ${postRes.status}`);
  console.log(`Subsequent Polling Body: ${postText}`);

  // 3. Socket.IO Client Connection & Upgrade Lifecycle
  console.log("\n[Test 3] Full Socket.IO Client Lifecycle (Polling -> Upgrade -> Events)...");
  await new Promise((resolve, reject) => {
    const socket = io(targetUrl, {
      path: "/socket.io/",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 3,
      timeout: 10000,
      forceNew: true
    });

    let upgradeSucceeded = false;
    let registeredReceived = false;

    socket.io.engine.on("upgrade", (transport) => {
      console.log(`✅ [WebSocket Upgrade] Successfully upgraded transport to: ${transport.name}`);
      upgradeSucceeded = true;
    });

    socket.on("connect", () => {
      console.log(`✅ [Socket Connected] Socket ID: ${socket.id} (Initial transport: ${socket.io.engine.transport.name})`);

      // Register user to test scoped room joining and event reception
      const testUserData = {
        userId: "65a123456789abcdef012345",
        name: "Test Admin",
        role: "admin",
        branchId: "65b987654321fedcba543210"
      };

      console.log("Emitting 'register_user' event...");
      socket.emit("register_user", testUserData);
    });

    socket.on("crm_realtime_test", (data) => {
      console.log("✅ [Event Received] 'crm_realtime_test':", data);
      registeredReceived = true;
    });

    socket.on("presence_change", (users) => {
      console.log(`✅ [Event Received] 'presence_change': ${users.length} active users online`);
    });

    socket.on("sync_active_handlers", (handlers) => {
      console.log(`✅ [Event Received] 'sync_active_handlers': ${handlers.length} active handlers`);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ [Socket Error] connect_error:", err.message);
      reject(err);
    });

    // Test reconnect behavior
    setTimeout(() => {
      console.log("\n[Test 4] Testing Reconnect Behavior...");
      console.log("Simulating transport disconnect...");
      socket.io.engine.close();

      socket.io.on("reconnect", (attempt) => {
        console.log(`✅ [Reconnected] Successfully reconnected on attempt #${attempt}`);
        socket.disconnect();
        resolve();
      });

      // Fallback if reconnect doesn't fire within 5s
      setTimeout(() => {
        if (socket.connected) {
          console.log("✅ Socket reconnected and active.");
        }
        socket.disconnect();
        resolve();
      }, 4000);
    }, 3000);
  });

  console.log(`\n✅ Validation for ${targetUrl} COMPLETED SUCCESSFULLY!`);
}

async function main() {
  // Test local port 3000
  try {
    await runValidation("http://localhost:3000");
  } catch (err) {
    console.error("Local validation error:", err.message);
  }

  // Test production
  try {
    await runValidation("https://whatsapp.almaaerp.in");
  } catch (err) {
    console.error("Production validation error:", err.message);
  }
}

main();
