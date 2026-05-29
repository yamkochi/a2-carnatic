"use server"

// 1. Import your getPool function from your database configuration file
// (Adjust the path '@/lib/db' to point to wherever this file is located)
import { getPool } from "@/lib/db"

export async function updateProfilePhoto(userId, filename) {
  try {
    // Debug checks to print in your terminal console
    console.log("--- MYSQL POOL UPDATE LOG ---")
    console.log("Updating User ID:", userId)
    console.log("Saving Filename:", filename)
    console.log("------------------------")

    if (!userId || !filename) {
      return { success: false, error: "Missing user ID or filename" }
    }

    // 2. Initialize your database connection pool
    const db = getPool()

    // 3. Run the pure MySQL execute query using the active pool instance
    const query = `UPDATE raga_users SET photo_path = ? WHERE id = ?`

    // Execute the query safely using prepared statements
    await db.execute(query, [filename, userId])

    return { success: true }
  } catch (error) {
    console.error("MySQL Database Error:", error)

    // Return the exact error to see if MySQL is still reporting "Data too long"
    return {
      success: false,
      error: error.message || "Could not save to MySQL database",
    }
  }
}
