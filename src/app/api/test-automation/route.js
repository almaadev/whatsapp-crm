import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import { getTemplateDetail, validateTemplatePayload } from "@/features/admin/services/twilioService";

export const dynamic = "force-dynamic";

export async function GET(req) {
  await connectDB();

  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;

  // Intercept console.log and console.error
  console.log = (...args) => {
    logs.push(args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" "));
    originalLog(...args);
  };
  console.error = (...args) => {
    logs.push("[ERROR] " + args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" "));
    originalError(...args);
  };

  const results = {};

  try {
    // ----------------------------------------------------
    // Scenario 1: Static Template (real SID from Twilio)
    // ----------------------------------------------------
    console.log("--- TEST SCENARIO 1: STATIC TEMPLATE ---");
    const staticSid = "HXbb83cfdc3f11296fb276ed0b905ceb6a";
    const staticTpl = await getTemplateDetail(staticSid);
    
    // Simulate what processKeywordAutoReply does
    const required1 = new Set();
    if (staticTpl?.body) {
      const regex = /\{\{([^}]+)\}\}/g;
      let match;
      while ((match = regex.exec(staticTpl.body)) !== null) {
        required1.add(match[1].trim());
      }
    }
    const isDynamic1 = required1.size > 0;
    
    console.log(`[AUTO REPLY]`);
    console.log(`Keyword: "book now"\n`);
    console.log(`Automation:\n- Rule ID: mock_rule_id_123\n- Template Name: ${staticTpl?.name || "Unknown"}\n- Content SID: ${staticSid}\n`);
    console.log(`Template Analysis:\n- Variables Required: ${isDynamic1 ? "Yes" : "No"}\n- Variables Found: No\n`);
    
    const val1 = validateTemplatePayload(staticTpl, null);
    console.log(`Validation result isValid: ${val1.isValid}`);
    console.log(`contentVariables: ${JSON.stringify(val1.contentVariables)}\n`);

    // ----------------------------------------------------
    // Scenario 2: Dynamic Template (Mocked) - Validation Success
    // ----------------------------------------------------
    console.log("--- TEST SCENARIO 2: DYNAMIC TEMPLATE (SUCCESS) ---");
    const mockDynamicTpl = {
      sid: "HXmockdynamic123",
      name: "appointment_confirmation",
      body: "Hello {{1}}, your appointment is on {{2}}."
    };

    const required2 = new Set(["1", "2"]);
    const isDynamic2 = true;
    const mockCustomer = { name: "John", city: "Chennai" };
    const contentVars2 = { "1": mockCustomer.name, "2": "Tomorrow" };

    console.log(`[AUTO REPLY]`);
    console.log(`Keyword: "confirm appointment"\n`);
    console.log(`Automation:\n- Rule ID: mock_rule_id_456\n- Template Name: ${mockDynamicTpl.name}\n- Content SID: ${mockDynamicTpl.sid}\n`);
    console.log(`Template Analysis:\n- Variables Required: ${isDynamic2 ? "Yes" : "No"}\n- Variables Found: ${contentVars2 ? "Yes" : "No"}\n`);
    console.log(`Generated Content Variables:\n${JSON.stringify(contentVars2, null, 2)}\n`);

    const val2 = validateTemplatePayload(mockDynamicTpl, contentVars2);
    console.log(`Validation result isValid: ${val2.isValid}`);
    console.log(`contentVariables: ${JSON.stringify(val2.contentVariables)}\n`);

    // ----------------------------------------------------
    // Scenario 3: Dynamic Template (Mocked) - Validation Failure (Missing variable)
    // ----------------------------------------------------
    console.log("--- TEST SCENARIO 3: DYNAMIC TEMPLATE (FAILURE) ---");
    const contentVars3 = { "1": "John" }; // Missing "2"

    console.log(`[AUTO REPLY]`);
    console.log(`Keyword: "confirm appointment"\n`);
    console.log(`Automation:\n- Rule ID: mock_rule_id_456\n- Template Name: ${mockDynamicTpl.name}\n- Content SID: ${mockDynamicTpl.sid}\n`);
    console.log(`Template Analysis:\n- Variables Required: ${isDynamic2 ? "Yes" : "No"}\n- Variables Found: ${contentVars3 ? "Yes" : "No"}\n`);
    console.log(`Generated Content Variables:\n${JSON.stringify(contentVars3, null, 2)}\n`);

    const val3 = validateTemplatePayload(mockDynamicTpl, contentVars3);
    if (!val3.isValid) {
      console.log(`Validation Failed\nReason:\n${val3.reason}\nTwilio request cancelled.\n`);
    }

    results.scenario1 = val1;
    results.scenario2 = val2;
    results.scenario3 = val3;

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    // Restore console methods
    console.log = originalLog;
    console.error = originalError;
  }

  return NextResponse.json({ success: true, results, logs });
}
