import { Client } from "@elastic/elasticsearch";
import { PrismaClient } from "@prisma/client";

const elastic = new Client({
  node: "https://localhost:9200",
  auth: {
    username: "elastic",
    password: "password",
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const prisma = new PrismaClient();

async function main() {
  console.time();

  const data = await prisma.conversations.findMany({
    include: {
      authors: true,
      annotations: true,
      context_annotations: {
        include: { context_domains: true, context_entities: true },
      },
      conversation_hashtags: { include: { hashtags: true } },
      links: true,
      parented: {
        include: {
          conversation: {
            include: {
              authors: true,
              conversation_hashtags: { include: { hashtags: true } },
            },
          },
        },
      },
    },
    skip: 5000 * 10,
    take: 5000,
  });

  const bulk = data.map((d) => {
    const insert = {
      id: d.id.toString(),
      author: {
        id: d.authors.id.toString(),
        username: {
          englando: d.authors.username,
          ngram: d.authors.username,
        },
        description: {
          englando: d.authors.description,
          shingles: d.authors.description,
        },
        followers_count: d.authors.followers_count,
        following_count: d.authors.following_count,
        tweet_count: d.authors.tweet_count,
        listed_count: d.authors.listed_count,
        name: {
          englando: d.authors.name,
          ngram: d.authors.name,
          shingles: d.authors.name,
        },
      },
      content: d.content,
      possibly_sensitive: d.possibly_sensitive,
      language: d.language,
      source: d.source,
      retweet_count: d.retweet_count,
      reply_count: d.reply_count,
      like_count: d.like_count,
      quote_count: d.quote_count,
      created_at: d.created_at,
      annotations: d.annotations.map((a) => ({
        id: a.id.toString(),
        value: a.value,
        type: a.type,
        probability: a.probability,
      })),
      context_annotations: d.context_annotations.map((a) => ({
        context_domain: {
          id: a.context_domains.id.toString(),
          name: a.context_domains.name,
          description: a.context_domains.description,
        },
        context_entity: {
          id: a.context_entities.id.toString(),
          name: a.context_entities.name,
          description: a.context_entities.description,
        },
      })),
      hashtags: d.conversation_hashtags.map((h) => h.hashtags.tag),
      links: d.links.map((l) => ({
        url: l.url,
        title: l.title,
        description: l.description,
      })),
      references: d.parented.map((p) => ({
        id: p.id.toString(),
        type: p.type,
        author: {
          id: p.conversation.authors.id.toString(),
          name: {
            englando: p.conversation.authors.name,
            ngram: p.conversation.authors.name,
            shingles: p.conversation.authors.name,
          },
          username: {
            englando: p.conversation.authors.username,
            ngram: p.conversation.authors.username,
          },
        },
        content: p.conversation.content,
        hashtags: p.conversation.conversation_hashtags.map(
          (h) => h.hashtags.tag
        ),
      })),
    };
    return [{ index: { _index: "tweets", _id: d.id.toString() } }, insert];
  });

  const response = await elastic.bulk({
    body: bulk.flat(),
  });

  console.log(response);
  console.timeEnd();
}

main().then(async () => {
  await prisma.$disconnect();
});
