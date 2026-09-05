import { NAVIGATION_CONFIG } from "../src/shared/config/navigation.js";

async function runSidebarAccordionTests() {
  console.log("\n==================================================");
  console.log("🧭 SIDEBAR ACCORDION BEHAVIOR UNIT TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function check(testNum, title, fn) {
    try {
      process.stdout.write(`⏳ Test ${testNum}: ${title}... `);
      fn();
      console.log("✅ PASSED");
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      console.error(err);
      failed++;
    }
  }

  // Helper matching Sidebar.jsx
  const isPathMatchingNav = (path, nav) => {
    if (!nav || !path) return false;
    if (nav.paths?.includes(path)) return true;
    if (nav.items?.some((item) => item.href === path)) return true;
    // Specific sub-path match without greedy root prefix matching
    if (nav.items?.some((item) => item.href !== "/crm/admin" && path.startsWith(item.href + "/"))) {
      return true;
    }
    if (nav.paths?.some((p) => p !== "/crm/admin" && path.startsWith(p + "/"))) {
      return true;
    }
    return false;
  };

  const getActiveMenuFromPath = (path) => {
    for (const nav of NAVIGATION_CONFIG) {
      if (nav.type === "dropdown") {
        const menuKey = nav.id || nav.stateKey || nav.label;
        if (isPathMatchingNav(path, nav)) {
          return menuKey;
        }
      }
    }
    return null;
  };

  // State simulator
  class SidebarStateSimulator {
    constructor(initialPath = "/crm/chat") {
      this.pathname = initialPath;
      this.openMenu = getActiveMenuFromPath(initialPath);
    }

    navigate(path) {
      this.pathname = path;
      const active = getActiveMenuFromPath(path);
      if (active) {
        this.openMenu = active;
      }
    }

    toggleMenu(menuKey) {
      this.openMenu = this.openMenu === menuKey ? null : menuKey;
    }

    isOpen(menuKey) {
      return this.openMenu === menuKey;
    }

    isActiveParent(nav) {
      return isPathMatchingNav(this.pathname, nav);
    }
  }

  // 1. Navigation config unique keys
  check(1, "NAVIGATION_CONFIG has unique keys for each dropdown menu", () => {
    const keys = [];
    NAVIGATION_CONFIG.forEach((nav) => {
      if (nav.type === "dropdown") {
        const key = nav.id || nav.stateKey || nav.label;
        if (keys.includes(key)) {
          throw new Error(`Duplicate dropdown key found: ${key}`);
        }
        keys.push(key);
      }
    });
    if (keys.length < 2) throw new Error("Expected at least 2 dropdown groups");
  });

  // 2. Initial route resolution
  check(2, "Initial route on /crm/admin opens 'dashboard' menu only", () => {
    const sim = new SidebarStateSimulator("/crm/admin");
    if (!sim.isOpen("dashboard")) throw new Error("Expected dashboard to be open for /crm/admin");
    if (sim.isOpen("associate-branch")) throw new Error("Associate and Branch should be closed");
  });

  check(3, "Initial route on /crm/admin/associate-management opens 'associate-branch' menu only", () => {
    const sim = new SidebarStateSimulator("/crm/admin/associate-management");
    if (!sim.isOpen("associate-branch")) throw new Error("Expected associate-branch to be open");
    if (sim.isOpen("dashboard")) throw new Error("Dashboard should be closed");
  });

  // 4. Accordion mutual exclusivity: Opening one closes the other
  check(4, "Opening 'dashboard' when 'associate-branch' is open immediately closes 'associate-branch'", () => {
    const sim = new SidebarStateSimulator("/crm/admin/branches");
    if (!sim.isOpen("associate-branch")) throw new Error("Initial state failed");

    sim.toggleMenu("dashboard");
    if (!sim.isOpen("dashboard")) throw new Error("dashboard should now be open");
    if (sim.isOpen("associate-branch")) throw new Error("associate-branch MUST be closed");
  });

  check(5, "Opening 'associate-branch' when 'dashboard' is open immediately closes 'dashboard'", () => {
    const sim = new SidebarStateSimulator("/crm/admin");
    if (!sim.isOpen("dashboard")) throw new Error("Initial state failed");

    sim.toggleMenu("associate-branch");
    if (!sim.isOpen("associate-branch")) throw new Error("associate-branch should now be open");
    if (sim.isOpen("dashboard")) throw new Error("dashboard MUST be closed");
  });

  // 6. Clicking currently open dropdown closes it
  check(6, "Clicking currently open dropdown toggles it closed (null)", () => {
    const sim = new SidebarStateSimulator("/crm/admin");
    if (!sim.isOpen("dashboard")) throw new Error("Initial state failed");

    sim.toggleMenu("dashboard");
    if (sim.openMenu !== null) throw new Error(`Expected openMenu to be null, got ${sim.openMenu}`);
    if (sim.isOpen("dashboard")) throw new Error("dashboard should be closed");
    if (sim.isOpen("associate-branch")) throw new Error("associate-branch should be closed");
  });

  // 7. Clicking closed dropdown opens it again
  check(7, "Clicking closed dropdown opens it", () => {
    const sim = new SidebarStateSimulator("/crm/chat");
    if (sim.openMenu !== null) throw new Error("Non-dropdown page should start with no open dropdowns");

    sim.toggleMenu("dashboard");
    if (!sim.isOpen("dashboard")) throw new Error("dashboard should now be open");

    sim.toggleMenu("associate-branch");
    if (!sim.isOpen("associate-branch")) throw new Error("associate-branch should now be open");
    if (sim.isOpen("dashboard")) throw new Error("dashboard should now be closed");
  });

  // 8. Submenu navigation preserves open parent and active highlighting
  check(8, "Navigating to a child route keeps correct parent open and active", () => {
    const sim = new SidebarStateSimulator("/crm/chat");
    sim.navigate("/crm/admin/reports");
    if (!sim.isOpen("dashboard")) throw new Error("Expected dashboard to be open for /crm/admin/reports");
    if (sim.isOpen("associate-branch")) throw new Error("associate-branch should remain closed");

    sim.navigate("/crm/admin/associate-logs");
    if (!sim.isOpen("associate-branch")) throw new Error("Expected associate-branch to be open for /crm/admin/associate-logs");
    if (sim.isOpen("dashboard")) throw new Error("dashboard should now be closed");

    const dashNav = NAVIGATION_CONFIG.find((n) => n.id === "dashboard");
    const assocNav = NAVIGATION_CONFIG.find((n) => n.id === "associate-branch");
    if (sim.isActiveParent(dashNav)) throw new Error("Dashboard should not be active when on /crm/admin/associate-logs");
    if (!sim.isActiveParent(assocNav)) throw new Error("Associate and Branch should be active when on /crm/admin/associate-logs");
  });

  console.log("\n==================================================");
  console.log(`📊 RESULTS: ${passed} PASSED | ${failed} FAILED | TOTAL 8 TESTS`);
  console.log("==================================================\n");

  if (failed > 0) process.exit(1);
}

runSidebarAccordionTests();
