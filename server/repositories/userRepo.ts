import { getDb } from "../mongo";
import { User } from "../models/user";

const COLLECTION = "users";

export function usersCollection() {
  return getDb().collection<User>(COLLECTION);
}

export async function findUserByEmail(email: string) {
  return usersCollection().findOne({ email });
}

export async function findUserById(id: string) {
  return usersCollection().findOne({ _id: new (require("mongodb").ObjectId)(id) });
}

export async function createUser(user: User) {
  await usersCollection().insertOne(user);
  return user;
}
