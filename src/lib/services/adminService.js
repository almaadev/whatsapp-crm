import { findAllUsers } from "../repositories/userRepository";
import { findLeadsByDateRange } from "../repositories/leadRepository";

export const adminService = {
  async getRosterMetrics(session, targetMonth, targetYear) {
    const isSuperAdmin = session?.user?.role === 'superAdmin';
    const currentUserEmail = session?.user?.email;

    const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

    const allUsers = await findAllUsers({ role: { $ne: 'superAdmin' } });
    let filteredUsers = allUsers;
    if (!isSuperAdmin) {
      filteredUsers = allUsers.filter(u => 
        (u.isAdmin !== true && u.department !== 'admin') || u.email === currentUserEmail
      );
    }

    const activeLeads = await findLeadsByDateRange(startDate, endDate);

    let companyAnalytics = { totalLeads: 0, totalPending: 0, totalFollowUp: 0, totalAchieved: 0, totalTarget: 0 };

    const roster = filteredUsers.map(user => {
      const userIdStr = user._id.toString();
      const userName = user.name;

      let totalLeads = 0;
      let pendingCount = 0;
      let followUpCount = 0;
      let achievedCount = 0;

      activeLeads.forEach(lead => {
        const history = lead.leads || [];
        const firstFollowUp = history.length > 0 ? history[0] : null;
        const latestFollowUp = history.length > 0 ? history[history.length - 1] : null;

        const originHandler = firstFollowUp?.associateId || lead.associateId;
        const currentHandler = latestFollowUp?.associateId || lead.assignedTo;
        
        const isOrigin = originHandler === userIdStr || originHandler === userName;
        const isCurrent = currentHandler === userIdStr || currentHandler === userName;

        const firstDate = new Date(firstFollowUp?.date || lead.createdAt);
        if (firstDate >= startDate && firstDate <= endDate && isOrigin) {
          totalLeads++;
          companyAnalytics.totalLeads++;
        }

        if (lead.isClosed && lead.closedById === userIdStr && lead.closedAt) {
          const closedDate = new Date(lead.closedAt);
          if (closedDate >= startDate && closedDate <= endDate) {
            achievedCount++;
            companyAnalytics.totalAchieved++;
          }
        }

        if (!lead.isClosed && isCurrent) {
          const status = latestFollowUp?.status || lead.status || "New";
          
          if (status === "Follow Up") {
            const followUpDate = new Date(latestFollowUp?.date || lead.createdAt);
            const hoursDiff = (Date.now() - followUpDate.getTime()) / (1000 * 60 * 60);
            if (hoursDiff > 48) {
              pendingCount++;
              companyAnalytics.totalPending++;
            } else {
              followUpCount++;
              companyAnalytics.totalFollowUp++;
            }
          } else if (status === "New" || status === "Not Interested") {
            pendingCount++;
            companyAnalytics.totalPending++;
          }
        }
      });

      const totalTarget = user.target || 0;
      companyAnalytics.totalTarget += totalTarget;
      
      const conversionRate = totalLeads > 0 ? Math.round((achievedCount / totalLeads) * 100) : 0;
      const progress = totalTarget > 0 ? Math.min(100, Math.round((achievedCount / totalTarget) * 100)) : 0;

      return {
        id: userIdStr, name: userName, role: user.role, branch: user.branch || "-", 
        target: totalTarget, totalLeads, pendingCount, followUpCount, achievedCount, conversionRate, progress
      };
    });

    return { success: true, roster, analytics: companyAnalytics };
  }
};
