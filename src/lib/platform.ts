import { db } from "./db";
import { PlatformService } from "@/domains/courses/service";
export const platform = new PlatformService(db);
