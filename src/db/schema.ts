import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const debateStatusEnum = pgEnum("debate_status", [
  "DRAFT",
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);

export const sideEnum = pgEnum("side", ["A", "B"]);

export const phaseEnum = pgEnum("phase", [
  "OPENING",
  "REBUTTAL",
  "CLOSING",
]);

export const winnerEnum = pgEnum("winner", ["A", "B", "TIE"]);

export const debates = pgTable("debates", {
  id: uuid("id").primaryKey().defaultRandom(),
  topic: text("topic").notNull(),
  modelA: text("model_a").notNull(),
  modelB: text("model_b").notNull(),
  status: debateStatusEnum("status").notNull().default("DRAFT"),
  finalWinner: winnerEnum("final_winner"),
  finalJson: jsonb("final_json"),
  errorJson: jsonb("error_json"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    debateId: uuid("debate_id")
      .notNull()
      .references(() => debates.id, { onDelete: "cascade" }),
    side: sideEnum("side").notNull(),
    phase: phaseEnum("phase").notNull(),
    turn: integer("turn").notNull(),
    content: text("content").notNull(),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    prompt: text("prompt"),
    rawResponse: text("raw_response"),
    tokenJson: jsonb("token_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_messages_debate_turn").on(table.debateId, table.turn),
    index("idx_messages_debate_side_phase").on(
      table.debateId,
      table.side,
      table.phase
    ),
    index("idx_messages_debate_created").on(table.debateId, table.createdAt),
  ]
);

export const digests = pgTable("digests", {
  debateId: uuid("debate_id")
    .primaryKey()
    .references(() => debates.id, { onDelete: "cascade" }),
  digestJson: jsonb("digest_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const judgeDecisions = pgTable(
  "judge_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    debateId: uuid("debate_id")
      .notNull()
      .references(() => debates.id, { onDelete: "cascade" }),
    judgeName: text("judge_name").notNull(),
    decisionJson: jsonb("decision_json").notNull(),
    prompt: text("prompt"),
    rawResponse: text("raw_response"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_judge_decision").on(table.debateId, table.judgeName),
  ]
);

export const humanLabels = pgTable(
  "human_labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    debateId: uuid("debate_id")
      .notNull()
      .references(() => debates.id, { onDelete: "cascade" }),
    winner: winnerEnum("winner").notNull(),
    confidence: integer("confidence").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_human_labels_debate_created").on(
      table.debateId,
      table.createdAt
    ),
  ]
);
