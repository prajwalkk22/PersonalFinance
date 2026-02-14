import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "personalfinance";

if (!uri) {
  throw new Error("MONGODB_URI must be set to connect to MongoDB");
}

const client = new MongoClient(uri, {
  // use unified topology by default in modern drivers
});

let dbInstance: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (!dbInstance) {
    await client.connect();
    dbInstance = client.db(dbName);
    console.log(`Connected to MongoDB database '${dbName}'`);
  }
  return dbInstance;
}

export function getMongoClient(): MongoClient {
  return client;
}

export function getDb(): Db {
  if (!dbInstance) throw new Error("MongoDB not connected. Call connectMongo() first.");
  return dbInstance;
}
