// Sample board, and the comments on its cards, rendered until the API serves them.
import type { Board, CardComment, Label, Member } from '@flowboard/shared';
import { addDays, toCalendarDay } from './due-date.ts';

const design: Label = { id: 'design', name: 'Design', color: 'violet' };
const content: Label = { id: 'content', name: 'Content', color: 'blue' };
const seo: Label = { id: 'seo', name: 'SEO', color: 'green' };
const legal: Label = { id: 'legal', name: 'Legal', color: 'amber' };
const frontend: Label = { id: 'frontend', name: 'Frontend', color: 'coral' };

const ada: Member = { id: 'ada', name: 'Ada Okafor', color: 'violet' };
const marco: Member = { id: 'marco', name: 'Marco Bianchi', color: 'amber' };
const lena: Member = { id: 'lena', name: 'Lena Fischer', color: 'green' };
const sam: Member = { id: 'sam', name: 'Sam Patel', color: 'blue' };

// Counted from the day the app loads, so the sample always shows every due-date state.
const loadedOn = new Date();
const dueIn = (days: number) => toCalendarDay(addDays(loadedOn, days));
const minutesAgo = (minutes: number) => new Date(loadedOn.getTime() - minutes * 60_000).toISOString();

/** By card id; a card without comments has no entry. */
export const sampleComments: Record<string, CardComment[]> = {
  'pricing-copy': [
    {
      id: 'c1',
      author: marco,
      body: 'Legal wants "refund within 14 days" spelled out, not "two weeks".',
      createdAt: minutesAgo(60 * 26),
    },
    {
      id: 'c2',
      author: lena,
      body: 'Updated. The FAQ now links to the full policy.',
      createdAt: minutesAgo(60 * 3),
    },
  ],
  cookies: [
    {
      id: 'c3',
      author: sam,
      body: 'The banner blocks the page on mobile Safari when the keyboard is open.',
      createdAt: minutesAgo(60 * 50),
    },
    {
      id: 'c4',
      author: ada,
      body: 'Bottom sheet instead of a modal?\nIt would also keep the page readable behind it.',
      createdAt: minutesAgo(60 * 49),
    },
    {
      id: 'c5',
      author: marco,
      body: 'Agreed, as long as "Reject all" stays as visible as "Accept all".',
      createdAt: minutesAgo(60 * 30),
    },
  ],
  navigation: [
    { id: 'c6', author: sam, body: 'Mobile menu is on the preview branch.', createdAt: minutesAgo(45) },
    {
      id: 'c7',
      author: ada,
      body: 'Looks good. The close button needs a larger touch target.',
      createdAt: minutesAgo(4),
    },
  ],
  'contact-form': [
    {
      id: 'c8',
      author: ada,
      body: 'The confirmation should repeat the email address, so a typo is caught.',
      createdAt: minutesAgo(60 * 24 * 6),
    },
  ],
};

const commentCount = (cardId: string) => sampleComments[cardId]?.length ?? 0;

export const sampleBoard: Board = {
  id: 'sample',
  title: 'Website relaunch',
  columns: [
    {
      id: 'todo',
      title: 'To do',
      color: 'gray',
      cards: [
        {
          id: 'pricing-copy',
          title: 'Write the pricing page copy',
          description:
            'Three plans, a comparison table and the FAQ. Legal reviews the refund wording before it goes live, and support checks that the answers match the help centre.',
          labels: [content, legal],
          dueDate: dueIn(5),
          assignees: [lena, marco],
          commentCount: commentCount('pricing-copy'),
        },
        {
          id: 'hero',
          title: 'Pick the hero illustration',
          description: '',
          labels: [design],
          dueDate: null,
          assignees: [],
          commentCount: commentCount('hero'),
        },
        {
          id: 'redirects',
          title: 'Redirect the old URLs',
          description: 'Every old path maps to its new page, so search rankings carry over.',
          labels: [seo],
          dueDate: dueIn(60),
          assignees: [sam],
          commentCount: commentCount('redirects'),
        },
        {
          id: 'cookies',
          title: 'Cookie banner',
          description: 'Essential cookies only by default; analytics after consent.',
          labels: [legal, frontend],
          dueDate: dueIn(-2),
          assignees: [marco, sam, lena, ada],
          commentCount: commentCount('cookies'),
        },
      ],
    },
    {
      id: 'in-progress',
      title: 'In progress',
      color: 'coral',
      cards: [
        {
          id: 'navigation',
          title: 'Navigation redesign',
          description: 'Mobile menu first, then the desktop one.',
          labels: [design, frontend],
          dueDate: dueIn(0),
          assignees: [ada, sam],
          commentCount: commentCount('navigation'),
        },
        {
          id: 'blog',
          title: 'Move the blog to the new CMS',
          description: '142 posts. Images keep their alt text; drafts stay unpublished.',
          labels: [content],
          dueDate: dueIn(1),
          assignees: [lena],
          commentCount: commentCount('blog'),
        },
      ],
    },
    { id: 'blocked', title: 'Blocked', color: 'red', cards: [] },
    {
      id: 'review',
      title: 'Review',
      color: 'blue',
      cards: [
        {
          id: 'contact-form',
          title: 'Contact form',
          description: 'Validation messages and the confirmation state.',
          labels: [frontend],
          dueDate: dueIn(-1),
          assignees: [sam, ada],
          commentCount: commentCount('contact-form'),
        },
      ],
    },
    {
      id: 'done',
      title: 'Done',
      color: 'green',
      cards: [
        {
          id: 'brand',
          title: 'Brand colours and type scale',
          description: '',
          labels: [design],
          dueDate: null,
          assignees: [ada],
          commentCount: commentCount('brand'),
        },
        {
          id: 'analytics',
          title: 'Analytics plan',
          description: 'Events for sign-up, trial start and plan change.',
          labels: [],
          dueDate: null,
          assignees: [marco],
          commentCount: commentCount('analytics'),
        },
      ],
    },
  ],
};
