import { findAllUsers, findUserByEmail, findUserById, createUser, updateUser, deleteUser } from "../repositories/userRepository";
import { getFromCache, setInCache, invalidateCache } from "./cacheService";
import bcrypt from "bcryptjs";

const USER_CACHE_KEY = "users:all";

const isAuthorized = (session) => {
    return session?.user?.role === 'superAdmin' || 
           (session?.user?.role === 'sales' && session?.user?.department === 'admin') ||  
           (session?.user?.role === 'doctor' && session?.user?.department === 'admin');
};

export const userService = {
  async getUsers(session) {
    if (!isAuthorized(session)) {
      const me = await findUserByEmail(session.user.email);
      if (!me) return [];
      return [{
        id: me._id.toString(), name: me.name, email: me.email, role: me.role,
        department: me.department, branch: me.branch || "", target: me.target || 0, achieved: me.achieved || 0,
      }];
    }

    let associates = await getFromCache(USER_CACHE_KEY);
    if (!associates) {
      const users = await findAllUsers({ role: { $ne: 'superAdmin' } });
      associates = users.map(u => ({
        id: u._id.toString(), name: u.name, preferredName: u.preferredName || "",
        email: u.email, number: u.number || "", role: u.role, department: u.department,
        branch: u.branch || "", active: u.active, leads: u.leads || 0,
        target: u.target || 0, achieved: u.achieved || 0,
      }));
      await setInCache(USER_CACHE_KEY, associates, 3600);
    }

    if (session.user.role === 'superAdmin') return associates;
    return associates.filter(u => u.department !== 'admin');
  },

  async createUser(body, session) {
    if (!isAuthorized(session)) throw new Error("Unauthorized");
    if (session.user.role !== 'superAdmin' && body.department === 'admin') throw new Error("Only Super Admin can create Admin users");
    if (!body.branch) throw new Error("Branch is mandatory");

    const salt = await bcrypt.genSalt(Number(process.env.SALT || 10));
    const hashedPassword = await bcrypt.hash(body.password, salt);

    await createUser({ 
        name: body.name, preferredName: body.preferredName || undefined, 
        email: body.email, number: body.number || undefined,
        password: hashedPassword, role: body.role, department: body.department, 
        branch: body.branch, isAdmin: body.isAdmin, active: body.active, 
        accessModules: body.accessModules, leads: 0, target: 0, achieved: 0 
    });

    await invalidateCache(USER_CACHE_KEY);
    return { success: true };
  },

  async updateUserPerformance(body, session) {
    if (!isAuthorized(session)) throw new Error("Unauthorized");
    const { rowId, target, leads, achieved } = body; 
    await updateUser(rowId, { leads, target, achieved });
    await invalidateCache(USER_CACHE_KEY);
    return { success: true };
  },

  async deleteUser(id, session) {
    if (!isAuthorized(session)) throw new Error("Unauthorized");
    await deleteUser(id);
    await invalidateCache(USER_CACHE_KEY);
    return { success: true };
  },

  async getUserById(id, session) {
    if (!isAuthorized(session)) throw new Error("Unauthorized");
    const user = await findUserById(id);
    if (!user) throw new Error("User not found");
    if (session.user.role !== 'superAdmin' && user.department === 'admin') throw new Error("Access Denied: Only Super Admins can manage other Admins");
    return user;
  },

  async updateUserDetails(id, body, session) {
    if (!isAuthorized(session)) throw new Error("Unauthorized");
    const existingUser = await findUserById(id);
    if (!existingUser) throw new Error("User not found");
    
    if (session.user.role !== 'superAdmin') {
      if (existingUser.department === 'admin' || body.department === 'admin') {
          throw new Error("Access Denied: Only Super Admin can manage Admins");
      }
    }

    let updateData = {
        name: body.name, email: body.email, role: body.role,
        number: body.number || "", department: body.department, branch: body.branch,
        isAdmin: body.isAdmin, active: body.active, accessModules: body.accessModules || [],
        preferredName: body.preferredName || ""
    };

    if (body.password && body.password.trim() !== "") {
      const salt = await bcrypt.genSalt(Number(process.env.SALT || 10));
      updateData.password = await bcrypt.hash(body.password, salt);
    }

    try {
      await updateUser(id, updateData, true);
      await invalidateCache(USER_CACHE_KEY);
      return { success: true };
    } catch (error) {
      if (error.code === 11000 && error.keyValue) {
        const duplicateField = Object.keys(error.keyValue)[0];
        let displayField = duplicateField === 'preferredName' ? 'Preferred Name' : 
                           duplicateField === 'email' ? 'Email' : 
                           duplicateField === 'phone' ? 'Phone Number' : duplicateField;
        throw new Error(`This ${displayField} is already registered. Please provide a different ${displayField}.`);
      }
      throw error;
    }
  }
};
