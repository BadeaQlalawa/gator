# Gator

Gator is a command-line RSS feed aggregator written in TypeScript.

## Requirements

Before running Gator, you need:

- Node.js
- PostgreSQL
- A PostgreSQL database
- The required npm dependencies

## Setup

Install the dependencies:

    npm install

Create a `.gatorconfig.json` file in your home directory.

Example:

    {
      "db_url": "postgres://username:password@localhost:5432/gator",
      "current_user_name": "your_username"
    }

## Usage

Run Gator with:

    npm run start <command>

Some available commands:

    npm run start register <username>
    npm run start login <username>
    npm run start users
    npm run start feeds
    npm run start following
    npm run start browse
    npm run start browse 5
    npm run start agg 1h

The `agg` command fetches RSS feeds and stores posts in the database.

The `browse` command displays posts from feeds followed by the current user.
