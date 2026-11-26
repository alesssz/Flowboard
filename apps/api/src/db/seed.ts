// Development data (pnpm db:seed): the demo account, and one sample board replacing every board.
import type { PaletteColor } from '@flowboard/shared';
import { hashPassword } from '../auth/passwords.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { createPrismaClient, readDatabaseUrl } from './client.ts';

// A published password, so development data only. Shorter than sign-up allows, which sign-in does not check.
const demoAccount = { email: 'demo@flowboard.local', password: 'flowboard', name: 'Ada Okafor' };

interface SeedCard {
  title: string;
  description?: string;
  labels?: { id: string }[];
  /** Days from the seed day; negative is overdue. */
  dueIn?: number;
  assignees?: { id: string }[];
  comments?: { author: { id: string }; body: string; minutesAgo: number }[];
}

interface SeedColumn {
  title: string;
  color: PaletteColor;
  cards: SeedCard[];
}

const seededAt = new Date();

// Counted from the seed day, so the board shows every due-date state; seeding again moves them.
// Stored as midnight UTC, which a date column keeps as the calendar day.
function dueIn(days: number): Date {
  return new Date(Date.UTC(seededAt.getFullYear(), seededAt.getMonth(), seededAt.getDate() + days));
}

function minutesAgo(minutes: number): Date {
  return new Date(seededAt.getTime() - minutes * 60_000);
}

async function seed(tx: Prisma.TransactionClient, demoPasswordHash: string): Promise<void> {
  // Created, or given back its name and password; its sessions stay.
  const { email, name } = demoAccount;
  const demo = await tx.user.upsert({
    where: { email },
    create: { email, name, passwordHash: demoPasswordHash },
    update: { name, passwordHash: demoPasswordHash },
    select: { id: true },
  });

  // Comments first: their authors' NoAction would stop the board's cascade (schema.prisma, Comment).
  await tx.comment.deleteMany();
  // Columns, cards, labels and members go with their board (onDelete: Cascade).
  await tx.board.deleteMany();

  const board = await tx.board.create({ data: { title: 'Website relaunch' } });
  const boardId = board.id;

  let labelPosition = 0;
  const label = (name: string, color: PaletteColor) =>
    tx.label.create({ data: { boardId, name, color, position: labelPosition++ }, select: { id: true } });
  const design = await label('Design', 'violet');
  const content = await label('Content', 'blue');
  const seo = await label('SEO', 'green');
  const legal = await label('Legal', 'amber');
  const frontend = await label('Frontend', 'coral');

  const member = (name: string, color: PaletteColor, userId?: string) =>
    tx.member.create({ data: { boardId, name, color, userId }, select: { id: true } });
  // The demo account works on the board as this member.
  const ada = await member(demoAccount.name, 'violet', demo.id);
  const marco = await member('Marco Bianchi', 'amber');
  const lena = await member('Lena Fischer', 'green');
  const sam = await member('Sam Patel', 'blue');

  const columns: SeedColumn[] = [
    {
      title: 'To do',
      color: 'gray',
      cards: [
        {
          title: 'Write the pricing page copy',
          description:
            'Three plans, a comparison table and the FAQ. Legal reviews the refund wording before it goes live, and support checks that the answers match the help centre.',
          labels: [content, legal],
          dueIn: 5,
          assignees: [lena, marco],
          comments: [
            {
              author: marco,
              body: 'Legal wants "refund within 14 days" spelled out, not "two weeks".',
              minutesAgo: 60 * 26,
            },
            { author: lena, body: 'Updated. The FAQ now links to the full policy.', minutesAgo: 60 * 3 },
          ],
        },
        { title: 'Pick the hero illustration', labels: [design] },
        {
          title: 'Redirect the old URLs',
          description: 'Every old path maps to its new page, so search rankings carry over.',
          labels: [seo],
          dueIn: 60,
          assignees: [sam],
        },
        {
          title: 'Cookie banner',
          description: 'Essential cookies only by default; analytics after consent.',
          labels: [legal, frontend],
          dueIn: -2,
          assignees: [marco, sam, lena, ada],
          comments: [
            {
              author: sam,
              body: 'The banner blocks the page on mobile Safari when the keyboard is open.',
              minutesAgo: 60 * 50,
            },
            {
              author: ada,
              body: 'Bottom sheet instead of a modal?\nIt would also keep the page readable behind it.',
              minutesAgo: 60 * 49,
            },
            {
              author: marco,
              body: 'Agreed, as long as "Reject all" stays as visible as "Accept all".',
              minutesAgo: 60 * 30,
            },
          ],
        },
      ],
    },
    {
      title: 'In progress',
      color: 'coral',
      cards: [
        {
          title: 'Navigation redesign',
          description: 'Mobile menu first, then the desktop one.',
          labels: [design, frontend],
          dueIn: 0,
          assignees: [ada, sam],
          comments: [
            { author: sam, body: 'Mobile menu is on the preview branch.', minutesAgo: 45 },
            { author: ada, body: 'Looks good. The close button needs a larger touch target.', minutesAgo: 4 },
          ],
        },
        {
          title: 'Move the blog to the new CMS',
          description: '142 posts. Images keep their alt text; drafts stay unpublished.',
          labels: [content],
          dueIn: 1,
          assignees: [lena],
        },
      ],
    },
    { title: 'Blocked', color: 'red', cards: [] },
    {
      title: 'Review',
      color: 'blue',
      cards: [
        {
          title: 'Contact form',
          description: 'Validation messages and the confirmation state.',
          labels: [frontend],
          dueIn: -1,
          assignees: [sam, ada],
          comments: [
            {
              author: ada,
              body: 'The confirmation should repeat the email address, so a typo is caught.',
              minutesAgo: 60 * 24 * 6,
            },
          ],
        },
      ],
    },
    {
      title: 'Done',
      color: 'green',
      cards: [
        { title: 'Brand colours and type scale', labels: [design], assignees: [ada] },
        {
          title: 'Analytics plan',
          description: 'Events for sign-up, trial start and plan change.',
          assignees: [marco],
        },
      ],
    },
  ];

  for (const [columnPosition, column] of columns.entries()) {
    await tx.column.create({
      data: {
        boardId,
        title: column.title,
        color: column.color,
        position: columnPosition,
        cards: {
          create: column.cards.map((card, cardPosition) => ({
            title: card.title,
            description: card.description ?? '',
            dueDate: card.dueIn === undefined ? null : dueIn(card.dueIn),
            position: cardPosition,
            labels: { connect: card.labels ?? [] },
            assignees: { connect: card.assignees ?? [] },
            comments: {
              create: (card.comments ?? []).map((comment) => ({
                authorId: comment.author.id,
                body: comment.body,
                createdAt: minutesAgo(comment.minutesAgo),
              })),
            },
          })),
        },
      },
    });
  }
}

const prisma = createPrismaClient(readDatabaseUrl());
try {
  // Hashed first: scrypt takes a moment, which the transaction need not wait for.
  const demoPasswordHash = await hashPassword(demoAccount.password);
  // All or nothing: a failure keeps the boards that were there.
  await prisma.$transaction((tx) => seed(tx, demoPasswordHash));
  console.log(`Seeded the sample board and the demo account: ${demoAccount.email}, password "${demoAccount.password}"`);
} finally {
  await prisma.$disconnect();
}
