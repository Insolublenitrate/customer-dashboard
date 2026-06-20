import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'

// Path to the SQLite database
// The Next.js app is in "customer-dashboard", the DB is in the parent directory.
const dbPath = path.resolve(process.cwd(), '../customer_leads.db')

export async function openDb() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  })
}
