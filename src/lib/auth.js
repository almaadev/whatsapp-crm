import CredentialsProvider from "next-auth/providers/credentials";
import { google } from "googleapis";

// Helper to fetch users from Google Sheets
async function getUserByEmail(email) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID

    if (!spreadsheetId) {
      console.error("❌ CRITICAL: No Spreadsheet ID found in .env.local");
      return null;
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Users!A:D",
    });

    const rows = response.data.values || [];
    const userRow = rows.find(row => row[1] === email);

    if (userRow) {
      return {
        name: userRow[0],
        email: userRow[1],
        password: userRow[2],
        role: userRow[3]?.toLowerCase()
      };
    }
    return null;

  } catch (error) {
    console.error("⚠️ LOGIN ERROR:", error.message);
    return null;
  }
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // 1. Check Google Sheet User
        const user = await getUserByEmail(credentials.email);

        // 2. Check Hardcoded Admin (Fallback)
        if (credentials.email === process.env.ADMIN_EMAIL && credentials.password === process.env.ADMIN_PASSWORD) {
   return { id: "0", name: "Super Admin", email: credentials.email, role: "admin" };
}

        // 3. Validate Sheet User
        if (user && user.password === credentials.password) {
          return { id: user.email, name: user.name, email: user.email, role: user.role };
        }

        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = user.role;
      return token;
    },
    async session({ session, token }) {
      if (session?.user) session.user.role = token.role;
      return session;
    }
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET ,
};