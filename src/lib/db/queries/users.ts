import { db } from "..";
import { eq, and, sql } from "drizzle-orm";
import { users, feeds, feedFollows, posts } from "../schema.ts";

export async function createUser(name: string) {
  const [result] = await db.insert(users).values({ name: name }).returning();
  return result;
}

export async function getUserByName(name: string) {
  const result = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.name, name),
  });

  return result;
}

export async function deleteAllUsers() {
  await db.delete(users);
}

export async function getUsers() {
  return await db.select().from(users);
}

export async function createFeed(
  name: string,
  url: string,
  userId: string
) {
  const [result] = await db
    .insert(feeds)
    .values({
      name: name,
      url: url,
      userId: userId,
    })
    .returning();

  return result;
}

export async function getFeeds() {
  return await db
    .select({
      name: feeds.name,
      url: feeds.url,
      userName: users.name,
    })
    .from(feeds)
    .innerJoin(users, eq(feeds.userId, users.id));
}

export async function getFeedByUrl(url: string) {
  return await db.query.feeds.findFirst({
    where: (feeds, { eq }) => eq(feeds.url, url),
  });
}

export async function createFeedFollow(
  userId: string,
  feedId: string
) {
  const [result] = await db
    .insert(feedFollows)
    .values({
      userId: userId,
      feedId: feedId,
    })
    .returning();

  const [follow] = await db
    .select({
      id: feedFollows.id,
      createdAt: feedFollows.createdAt,
      updatedAt: feedFollows.updatedAt,
      userId: feedFollows.userId,
      feedId: feedFollows.feedId,
      userName: users.name,
      feedName: feeds.name,
    })
    .from(feedFollows)
    .innerJoin(users, eq(feedFollows.userId, users.id))
    .innerJoin(feeds, eq(feedFollows.feedId, feeds.id))
    .where(eq(feedFollows.id, result.id));

  return follow;
}

export async function getFeedFollowsForUser(userId: string) {
  return await db
    .select({
      userName: users.name,
      feedName: feeds.name,
    })
    .from(feedFollows)
    .innerJoin(users, eq(feedFollows.userId, users.id))
    .innerJoin(feeds, eq(feedFollows.feedId, feeds.id))
    .where(eq(feedFollows.userId, userId));
}

export async function deleteFeedFollow(userId: string, feedUrl: string) {
  const feed = await getFeedByUrl(feedUrl);

  if (!feed) {
    throw new Error(`Feed ${feedUrl} does not exist`);
  }

  await db
    .delete(feedFollows)
    .where(
      and(
        eq(feedFollows.userId, userId),
        eq(feedFollows.feedId, feed.id)
      )
    );
}

export async function markFeedFetched(feedId: string) {
  const [feed] = await db
    .update(feeds)
    .set({
      lastFetchedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(feeds.id, feedId))
    .returning();

  return feed;
}

export async function getNextFeedToFetch() {
  const [feed] = await db
    .select()
    .from(feeds)
    .orderBy(sql`${feeds.lastFetchedAt} ASC NULLS FIRST`)
    .limit(1);

  return feed;
}


export async function createPost(
  title: string,
  url: string,
  description: string | null,
  publishedAt: Date | null,
  feedId: string
) {
  const [post] = await db
    .insert(posts)
    .values({
      title,
      url,
      description,
      publishedAt,
      feedId,
    })
    .returning();

  return post;
}

export async function getPostsForUser(userId: string, limit: number) {
  return await db
    .select({
      id: posts.id,
      title: posts.title,
      url: posts.url,
      description: posts.description,
      publishedAt: posts.publishedAt,
      feedName: feeds.name,
    })
    .from(posts)
    .innerJoin(feeds, eq(posts.feedId, feeds.id))
    .innerJoin(feedFollows, eq(feedFollows.feedId, feeds.id))
    .where(eq(feedFollows.userId, userId))
    .orderBy(sql`${posts.publishedAt} DESC`)
    .limit(limit);
}
