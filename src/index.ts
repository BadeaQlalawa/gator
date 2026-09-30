import { fetchFeed } from "./rss/index.ts";
import { readConfig, setUser } from "./config.ts";
import { createUser, getUserByName, deleteAllUsers, getUsers, createFeed, getFeeds, createFeedFollow, getFeedByUrl, getFeedFollowsForUser, deleteFeedFollow, getNextFeedToFetch, markFeedFetched, createPost, getPostsForUser } from "./lib/db/queries/users.ts";
import { users } from "./lib/db/schema.ts";
import { InferSelectModel } from "drizzle-orm";

type CommandHandler = (cmdName: string, ...args: string[]) => Promise<void>;

type CommandsRegistry = Record<string, CommandHandler>;

type User = InferSelectModel<typeof users>;

type UserCommandHandler = (
  cmdName: string,
  user: User,
  ...args: string[]
) => Promise<void>;

type MiddlewareLoggedIn = (handler: UserCommandHandler) => CommandHandler;



function middlewareLoggedIn(
  handler: UserCommandHandler
): CommandHandler {
  return async (cmdName: string, ...args: string[]): Promise<void> => {
    const config = readConfig();

    if (!config.currentUserName) {
      throw new Error("No user is logged in");
    }

    const user = await getUserByName(config.currentUserName);

    if (!user) {
      throw new Error(`User ${config.currentUserName} does not exist`);
    }

    await handler(cmdName, user, ...args);
  };
}

async function handlerLogin(cmdName: string, ...args: string[]): Promise<void> {
  if (args.length === 0) {
    throw new Error("username is required");
  }

  const username = args[0];

  const user = await getUserByName(username);

  if (!user) {
    throw new Error(`User ${username} does not exist`);
  }

  setUser(username);

  console.log(`user has been set to ${username}`);
}

async function handlerRegister(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length === 0) {
    throw new Error("username is required");
  }

  const username = args[0];

  const existingUser = await getUserByName(username);

  if (existingUser) {
    throw new Error(`User ${username} already exists`);
  }

  const user = await createUser(username);

  setUser(username);

  console.log(`user ${username} was created`);
  console.log(user);
}

async function handlerFollow(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length === 0) {
    throw new Error("feed URL is required");
  }

  const feed = await getFeedByUrl(args[0]);

  if (!feed) {
    throw new Error(`Feed ${args[0]} does not exist`);
  }

  const follow = await createFeedFollow(user.id, feed.id);

  console.log(
    `User ${follow.userName} is now following ${follow.feedName}`
  );
}

async function handlerUnfollow(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length === 0) {
    throw new Error("feed URL is required");
  }

  await deleteFeedFollow(user.id, args[0]);
}

async function handlerFollowing(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  const follows = await getFeedFollowsForUser(user.id);

  for (const follow of follows) {
    console.log(`* ${follow.feedName}`);
  }
}

async function handlerReset(cmdName: string, ...args: string[]): Promise<void> {
  await deleteAllUsers();
  console.log("Database reset successfully");
}

async function handlerUsers(cmdName: string, ...args: string[]): Promise<void> {
  const allUsers = await getUsers();
  const config = readConfig();

  for (const user of allUsers) {
    if (user.name === config.currentUserName) {
      console.log(`* ${user.name} (current)`);
    } else {
      console.log(`* ${user.name}`);
    }
  }
}

async function handlerAddFeed(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length < 2) {
    throw new Error("name and url are required");
  }

  const feed = await createFeed(args[0], args[1], user.id);

  const follow = await createFeedFollow(user.id, feed.id);

  console.log(
    `User ${follow.userName} is now following ${follow.feedName}`
  );
}

async function handlerFeeds(cmdName: string, ...args: string[]): Promise<void> {
  const feeds = await getFeeds();

  for (const feed of feeds) {
    console.log(`* ${feed.name} - ${feed.url} - ${feed.userName}`);
  }
}

async function scrapeFeeds(): Promise<void> {
  const feed = await getNextFeedToFetch();

  if (!feed) {
    throw new Error("No feeds found");
  }

  console.log(`Fetching feed: ${feed.name}`);

  const rssFeed = await fetchFeed(feed.url);

  await markFeedFetched(feed.id);

  for (const item of rssFeed.channel.item) {
    const publishedAt = item.pubDate
      ? new Date(item.pubDate)
      : null;

    await createPost(
      item.title,
      item.link,
      item.description ?? null,
      publishedAt,
      feed.id
    );
  }
}

function handleError(error: unknown): void {
  console.error(error);
}

function parseDuration(durationStr: string): number {
  const regex = /^(\d+)(ms|s|m|h)$/;
  const match = durationStr.match(regex);

  if (!match) {
    throw new Error("Invalid duration format");
  }

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return amount;
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    default:
      throw new Error("Invalid duration unit");
  }
}

async function handlerAgg(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length === 0) {
    throw new Error("time_between_reqs is required");
  }

  const timeBetweenRequests = parseDuration(args[0]);

  console.log(`Collecting feeds every ${args[0]}`);

  await scrapeFeeds();

  const interval = setInterval(() => {
    scrapeFeeds().catch(handleError);
  }, timeBetweenRequests);

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      console.log("Shutting down feed aggregator...");
      clearInterval(interval);
      resolve();
    });
  });
}

async function handlerBrowse(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  let limit = 2;

  if (args.length > 0) {
    limit = Number(args[0]);

    if (Number.isNaN(limit) || limit <= 0) {
      throw new Error("limit must be a positive number");
    }
  }

  const posts = await getPostsForUser(user.id, limit);

  for (const post of posts) {
    console.log(post.title);
    console.log(post.url);
    console.log();
  }
}

function registerCommand(
  registry: CommandsRegistry,
  cmdName: string,
  handler: CommandHandler
): void {
  registry[cmdName] = handler;
}

async function runCommand(
  registry: CommandsRegistry,
  cmdName: string,
  ...args: string[]
): Promise<void> {
  const handler = registry[cmdName];

  if (!handler) {
    throw new Error(`unknown command: ${cmdName}`);
  }

  await handler(cmdName, ...args);
}

async function main(): Promise<void> {
  const registry: CommandsRegistry = {};

  registerCommand(registry, "login", handlerLogin);
  registerCommand(registry, "register", handlerRegister);
  registerCommand(registry, "reset", handlerReset);
  registerCommand(registry, "users", handlerUsers);
  registerCommand(registry, "agg", handlerAgg);
  registerCommand(registry, "addfeed", middlewareLoggedIn(handlerAddFeed));
  registerCommand(registry, "feeds", handlerFeeds);
  registerCommand(registry, "follow", middlewareLoggedIn(handlerFollow));
  registerCommand(registry, "following", middlewareLoggedIn(handlerFollowing));
  registerCommand(registry, "unfollow", middlewareLoggedIn(handlerUnfollow));
  registerCommand(registry, "browse", middlewareLoggedIn(handlerBrowse));

  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Error: not enough arguments");
    process.exit(1);
  }

  const cmdName = args[0];
  const cmdArgs = args.slice(1);

  try {
    await runCommand(registry, cmdName, ...cmdArgs);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

main();
